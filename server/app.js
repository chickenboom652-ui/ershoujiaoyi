import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from './store.js';

export const CATEGORIES = ['教材书籍', '数码电子', '宿舍好物', '服饰配件', '运动户外', '其他闲置'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const equal = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const text = (value, label, min, max) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(`${label}需为 ${min}–${max} 个字符`);
  return value.trim();
};

export function validateProduct(body) {
  const title = text(body.title, '商品名称', 2, 40);
  const description = text(body.description, '商品简介', 1, 1000);
  if (!CATEGORIES.includes(body.category)) throw fail('请选择有效分类');
  if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 999) throw fail('数量必须是 1–999 的整数');
  const price = String(body.price ?? '');
  if (!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(price)) throw fail('价格最多两位小数');
  const [yuan, fraction = ''] = price.split('.');
  const price_cents = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
  if (price_cents < 1 || price_cents > 99999900) throw fail('价格需为 0.01–999999 元');
  if (!['pickup', 'delivery'].includes(body.delivery)) throw fail('请选择交付方式');
  const location = text(body.location ?? '', body.delivery === 'pickup' ? '自取地点' : '送达说明', body.delivery === 'pickup' ? 1 : 0, 120);
  if (!['wechat', 'phone'].includes(body.contact_type)) throw fail('请选择联系方式类型');
  const contact_value = text(body.contact_value, '联系方式', 3, 50);
  if (body.contact_type === 'phone' && !/^1[3-9]\d{9}$/.test(contact_value)) throw fail('请填写有效的 11 位手机号');
  if (body.contact_consent !== true) throw fail('请同意向登录用户展示联系方式');
  if (!Array.isArray(body.photo_ids) || body.photo_ids.length < 1 || body.photo_ids.length > 6 || new Set(body.photo_ids).size !== body.photo_ids.length || body.photo_ids.some(id => typeof id !== 'string')) throw fail('请上传 1–6 张不重复的商品照片');
  return { title, description, category: body.category, quantity: body.quantity, price_cents, delivery: body.delivery, location, contact_type: body.contact_type, contact_value, photo_ids: body.photo_ids };
}

export function createApp({ db, uploadDir, demo = false, adminPassword, mediaSecret, wxAppId, wxAppSecret, schoolName = '本校', rateLimits = true, trustProxy = false }) {
  if (!mediaSecret || !adminPassword) throw new Error('必须配置媒体签名密钥和管理员密码');
  mkdirSync(uploadDir, { recursive: true });
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'blob:', 'data:'], 'connect-src': ["'self'"], 'upgrade-insecure-requests': demo ? null : [] } }, strictTransportSecurity: demo ? false : undefined }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // 同源浏览器请求防护；小程序不发送 Origin。
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) throw fail('不允许跨站请求', 403); }
      catch (error) { return next(error.status ? error : fail('无效来源', 403)); }
    }
    next();
  });
  if (rateLimits) app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '请求过于频繁，请稍后再试' } }));
  if (rateLimits) app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 20, message: { error: '登录尝试过多，请稍后重试' } }));
  app.use('/api', (req, _res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (token) req.auth = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token), Date.now());
    next();
  });
  const requireUser = (req, _res, next) => next(req.auth?.role === 'user' ? undefined : fail('请先登录', 401));
  const requireAdmin = (req, _res, next) => next(req.auth?.role === 'admin' ? undefined : fail('需要管理员登录', 401));
  const issueSession = (userId, role) => {
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token), userId, role, Date.now() + (role === 'admin' ? 8 : 24 * 7) * 3600000);
    return token;
  };
  const login = (openid, name) => {
    let user = db.prepare('SELECT * FROM users WHERE openid=?').get(openid);
    if (!user) {
      user = { id: randomUUID(), name };
      db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(user.id, openid, name, Date.now());
    }
    return { token: issueSession(user.id, 'user'), user: { id: user.id, name: user.name } };
  };
  const getProduct = id => { const row = db.prepare('SELECT * FROM products WHERE id=?').get(id); if (!row) throw fail('商品不存在', 404); return row; };
  const ownerProduct = req => { const p = getProduct(req.params.id); if (p.owner_id !== req.auth.user_id) throw fail('只能修改自己的商品', 403); return p; };
  const mediaSignature = (id, expires) => createHmac('sha256', mediaSecret).update(`${id}:${expires}`).digest('hex');
  const photosFor = (id, signed = false) => db.prepare('SELECT m.id FROM product_media pm JOIN media m ON m.id=pm.media_id WHERE pm.product_id=? ORDER BY pm.position').all(id).map(m => {
    const expires = Date.now() + 3600000;
    return { id: m.id, url: `/api/media/${m.id}${signed ? `?expires=${expires}&signature=${mediaSignature(m.id, expires)}` : ''}` };
  });
  const serialize = (p, req, detail = false) => {
    const owner = p.owner_id === req.auth?.user_id;
    const admin = req.auth?.role === 'admin';
    const available = p.status === 'active';
    const favorite = Boolean(req.auth?.user_id && db.prepare('SELECT 1 FROM favorites WHERE user_id=? AND product_id=?').get(req.auth.user_id, p.id));
    const result = { id: p.id, title: p.title, category: p.category, quantity: p.quantity, price: (p.price_cents / 100).toFixed(2), delivery: p.delivery, status: p.status, created_at: p.created_at, updated_at: p.updated_at, is_owner: owner, is_favorite: favorite, photos: photosFor(p.id, owner || admin), seller_name: db.prepare('SELECT name FROM users WHERE id=?').get(p.owner_id).name };
    if (detail) result.description = p.description;
    if (owner || admin) Object.assign(result, { location: p.location, contact_type: p.contact_type, contact_value: p.contact_value, review_note: p.review_note });
    result.can_contact = available;
    return result;
  };
  const attachPhotos = (productId, photoIds, ownerId) => {
    for (const id of photoIds) if (!db.prepare('SELECT 1 FROM media WHERE id=? AND owner_id=?').get(id, ownerId)) throw fail('照片不存在或不属于你');
    db.prepare('DELETE FROM product_media WHERE product_id=?').run(productId);
    photoIds.forEach((id, i) => db.prepare('INSERT INTO product_media VALUES(?,?,?)').run(productId, id, i));
  };

  app.get('/api/config', (_req, res) => res.json({ schoolName, categories: CATEGORIES, demo, maxPhotos: 6 }));
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }); });
  app.post('/api/auth/demo', (req, res) => {
    if (!demo || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw fail('演示登录未开启', 403);
    if (!['seller', 'buyer'].includes(req.body.account)) throw fail('请选择演示账号');
    res.json(login(`demo:${req.body.account}`, req.body.account === 'seller' ? '小林同学（演示）' : '小陈同学（演示）'));
  });
  app.post('/api/auth/wechat', async (req, res) => {
    if (!wxAppId || !wxAppSecret) throw fail('尚未配置微信登录，请由运营者设置 AppID 和 AppSecret', 503);
    const code = text(req.body.code, '微信登录凭证', 1, 256);
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({ appid: wxAppId, secret: wxAppSecret, js_code: code, grant_type: 'authorization_code' }).toString();
    let info;
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!response.ok) throw Error(); info = await response.json(); }
    catch { throw fail('微信登录服务暂时不可用，请稍后重试', 502); }
    if (!info.openid || info.errcode) throw fail('微信登录凭证失效，请重试', 401);
    res.json(login(info.openid, `校园同学${hash(info.openid).slice(0, 4)}`));
  });
  app.post('/api/auth/admin', (req, res) => {
    if (typeof req.body.password !== 'string' || !equal(req.body.password, adminPassword)) throw fail('管理员密码不正确', 401);
    res.json({ token: issueSession(null, 'admin') });
  });
  app.post('/api/auth/logout', (req, res) => { if (req.auth) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.auth.token_hash); res.json({ ok: true }); });
  app.get('/api/me', requireUser, (req, res) => res.json(db.prepare('SELECT id,name FROM users WHERE id=?').get(req.auth.user_id)));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 } });
  if (rateLimits) app.use('/api/uploads', rateLimit({ windowMs: 3600000, limit: 40, message: { error: '上传次数过多，请稍后再试' } }));
  app.post('/api/uploads', requireUser, upload.single('photo'), async (req, res) => {
    if (!req.file) throw fail('请选择照片');
    const id = randomUUID();
    const filename = `${id}.webp`;
    try {
      const img = sharp(req.file.buffer, { limitInputPixels: 25000000 });
      const meta = await img.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages ?? 1) > 1) throw Error();
      await img.rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(uploadDir, filename));
    } catch { throw fail('照片需为有效的 JPG、PNG 或静态 WebP，尺寸不超过 2500 万像素'); }
    db.prepare('INSERT INTO media VALUES(?,?,?,?)').run(id, req.auth.user_id, filename, Date.now());
    const expires = Date.now() + 3600000;
    res.status(201).json({ id, url: `/api/media/${id}?expires=${expires}&signature=${mediaSignature(id, expires)}` });
  });
  app.get('/api/media/:id', (req, res) => {
    const m = db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id);
    if (!m) throw fail('图片不存在', 404);
    const publicMedia = db.prepare("SELECT 1 FROM product_media pm JOIN products p ON pm.product_id=p.id WHERE pm.media_id=? AND p.status='active'").get(m.id);
    const expires = Number(req.query.expires);
    const signed = Number.isSafeInteger(expires) && expires > Date.now() && expires <= Date.now() + 3600000 && typeof req.query.signature === 'string' && equal(req.query.signature, mediaSignature(m.id, expires));
    if (!publicMedia && !signed && req.auth?.user_id !== m.owner_id && req.auth?.role !== 'admin') throw fail('图片不可访问', 404);
    res.set('Cache-Control', 'private, no-store').type('webp').sendFile(resolve(uploadDir, m.filename));
  });

  app.get('/api/products', (req, res) => {
    const q = text(req.query.q ?? '', '搜索词', 0, 80);
    const category = req.query.category ?? '';
    if (category && !CATEGORIES.includes(category)) throw fail('无效分类');
    const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page) || 1)));
    const values = []; const clauses = ["status='active'"];
    if (q) { clauses.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"); const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`; values.push(pattern, pattern); }
    if (category) { clauses.push('category=?'); values.push(category); }
    const where = clauses.join(' AND ');
    const total = db.prepare(`SELECT count(*) AS n FROM products WHERE ${where}`).get(...values).n;
    const items = db.prepare(`SELECT * FROM products WHERE ${where} ORDER BY created_at DESC, id LIMIT 20 OFFSET ?`).all(...values, (page - 1) * 20).map(p => serialize(p, req));
    res.json({ items, total, page, hasMore: page * 20 < total });
  });
  app.get('/api/mine', requireUser, (req, res) => res.json({ items: db.prepare('SELECT * FROM products WHERE owner_id=? ORDER BY updated_at DESC').all(req.auth.user_id).map(p => serialize(p, req, true)) }));
  app.get('/api/favorites', requireUser, (req, res) => res.json({ items: db.prepare('SELECT p.* FROM favorites f JOIN products p ON f.product_id=p.id WHERE f.user_id=? ORDER BY f.created_at DESC').all(req.auth.user_id).map(p => p.status === 'active' || p.owner_id === req.auth.user_id ? serialize(p, req) : { id: p.id, title: p.title, status: p.status, unavailable: true, is_favorite: true, photos: [] }) }));
  app.get('/api/products/:id', (req, res) => {
    const p = getProduct(req.params.id);
    if (p.status !== 'active' && p.owner_id !== req.auth?.user_id && req.auth?.role !== 'admin') throw fail('商品已售出、下架或尚未审核', 404);
    res.json(serialize(p, req, true));
  });
  app.get('/api/products/:id/contact', requireUser, (req, res) => {
    const p = getProduct(req.params.id);
    if (p.status !== 'active') throw fail('该商品当前不可联系', 409);
    res.json({ contact_type: p.contact_type, contact_value: p.contact_value, location: p.location, delivery: p.delivery });
  });
  app.post('/api/products', requireUser, (req, res) => {
    const p = validateProduct(req.body); const id = randomUUID(); const now = Date.now();
    transaction(db, () => {
      db.prepare('INSERT INTO products (id,owner_id,title,description,category,quantity,price_cents,delivery,location,contact_type,contact_value,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, req.auth.user_id, p.title, p.description, p.category, p.quantity, p.price_cents, p.delivery, p.location, p.contact_type, p.contact_value, 'pending', now, now);
      attachPhotos(id, p.photo_ids, req.auth.user_id);
    });
    res.status(201).json(serialize(getProduct(id), req, true));
  });
  app.put('/api/products/:id', requireUser, (req, res) => {
    ownerProduct(req); const p = validateProduct(req.body);
    transaction(db, () => {
      attachPhotos(req.params.id, p.photo_ids, req.auth.user_id);
      db.prepare("UPDATE products SET title=?,description=?,category=?,quantity=?,price_cents=?,delivery=?,location=?,contact_type=?,contact_value=?,status='pending',review_note='',updated_at=? WHERE id=?").run(p.title, p.description, p.category, p.quantity, p.price_cents, p.delivery, p.location, p.contact_type, p.contact_value, Date.now(), req.params.id);
    });
    res.json(serialize(getProduct(req.params.id), req, true));
  });
  app.patch('/api/products/:id/status', requireUser, (req, res) => {
    const p = ownerProduct(req); const status = req.body.status;
    if (!['sold', 'hidden', 'pending'].includes(status)) throw fail('无效商品状态');
    if (status === 'sold' && p.status !== 'active') throw fail('只有在售商品可以标记已售');
    if (status === 'pending' && p.status === 'active') throw fail('商品已在展示中');
    db.prepare("UPDATE products SET status=?,review_note='',updated_at=? WHERE id=?").run(status, Date.now(), p.id);
    res.json({ ok: true });
  });
  app.put('/api/products/:id/favorite', requireUser, (req, res) => {
    const p = getProduct(req.params.id); if (p.status !== 'active') throw fail('只能收藏在售商品', 409);
    db.prepare('INSERT OR IGNORE INTO favorites VALUES(?,?,?)').run(req.auth.user_id, p.id, Date.now()); res.json({ ok: true });
  });
  app.delete('/api/products/:id/favorite', requireUser, (req, res) => { db.prepare('DELETE FROM favorites WHERE user_id=? AND product_id=?').run(req.auth.user_id, req.params.id); res.json({ ok: true }); });
  app.post('/api/products/:id/report', requireUser, (req, res) => {
    const p = getProduct(req.params.id); if (p.status !== 'active') throw fail('商品不可举报', 409);
    const reason = text(req.body.reason, '举报原因', 2, 300);
    if (db.prepare('SELECT 1 FROM reports WHERE user_id=? AND product_id=? AND resolved=0').get(req.auth.user_id, p.id)) throw fail('你已举报过该商品，正在处理中', 409);
    db.prepare('INSERT INTO reports VALUES(?,?,?,?,0,?)').run(randomUUID(), req.auth.user_id, p.id, reason, Date.now()); res.status(201).json({ ok: true });
  });
  app.get('/api/admin/products', requireAdmin, (req, res) => res.json({ items: db.prepare('SELECT * FROM products ORDER BY updated_at DESC LIMIT 200').all().map(p => serialize(p, req, true)) }));
  app.post('/api/admin/products/:id/review', requireAdmin, (req, res) => {
    const p = getProduct(req.params.id); const status = req.body.status;
    if (!['active', 'rejected', 'hidden'].includes(status)) throw fail('无效审核结果');
    if (status === 'active' && p.status !== 'pending') throw fail('只能通过待审核商品', 409);
    const note = text(req.body.note ?? '', '审核说明', status === 'active' ? 0 : 2, 300);
    transaction(db, () => {
      db.prepare('UPDATE products SET status=?,review_note=?,updated_at=? WHERE id=?').run(status, note, Date.now(), p.id);
      db.prepare('INSERT INTO audit_log(product_id,action,note,created_at) VALUES(?,?,?,?)').run(p.id, status, note, Date.now());
    }); res.json({ ok: true });
  });
  app.get('/api/admin/reports', requireAdmin, (_req, res) => res.json({ items: db.prepare('SELECT r.*,p.title FROM reports r JOIN products p ON p.id=r.product_id ORDER BY r.resolved,r.created_at DESC LIMIT 200').all() }));
  app.patch('/api/admin/reports/:id', requireAdmin, (req, res) => { const result = db.prepare('UPDATE reports SET resolved=1 WHERE id=?').run(req.params.id); if (!result.changes) throw fail('举报不存在', 404); res.json({ ok: true }); });
  app.use('/api', (_req, _res, next) => next(fail('接口不存在', 404)));
  app.use(express.static(join(root, 'web')));
  app.use((error, _req, res, _next) => {
    let status = error.status ?? 500; let message = error.message;
    if (error instanceof multer.MulterError) { status = 400; message = '每次上传一张照片，大小不超过 8MB'; }
    if (status >= 500) { console.error(error.name, error.status ? error.message : '内部服务错误'); message = error.status ? error.message : '服务暂时不可用，请稍后重试'; }
    res.status(status).json({ error: message });
  });
  return app;
}
