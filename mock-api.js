// 静态演示专用（仅存在于 GitHub Pages 演示分支）：拦截 /api 请求，用 localStorage 里的
// 演示数据应答，复刻 server/ 的演示种子与主要接口行为；所有标签页共享、刷新后仍在。
// 真实部署请删除本文件，使用 server/ 的 Express API。
(() => {
  const KEY = 'qingji-demo-state-v1';
  const svgUri = a => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="440"><rect width="500" height="440" fill="${a.bg}"/><ellipse cx="250" cy="375" rx="145" ry="15" fill="#000" opacity=".04"/>${a.art}</svg>`;
  const art = [
    ['教材书籍', '#e7edde', '<rect x="130" y="100" width="180" height="235" rx="8" fill="#457263" transform="rotate(-10 220 220)"/><rect x="190" y="120" width="170" height="225" rx="8" fill="#f6f0d8" transform="rotate(8 260 230)"/><path d="M215 180h115M215 195h80M215 265h100M215 280h100" stroke="#759187" stroke-width="8"/>'],
    ['数码电子', '#e5ede9', '<rect x="112" y="160" width="275" height="175" rx="28" fill="#e9e5d8"/><path d="M180 160l20-35h100l20 35" fill="#454d48"/><circle cx="250" cy="245" r="70" fill="#384d48"/><circle cx="250" cy="245" r="48" fill="#6c9690"/><circle cx="250" cy="245" r="25" fill="#263c3b"/><rect x="135" y="181" width="44" height="20" rx="4" fill="#6c9690"/>'],
    ['宿舍好物', '#f4ead7', '<ellipse cx="250" cy="345" rx="105" ry="20" fill="#b7b79c"/><path d="M250 340V210l60-75" fill="none" stroke="#dfac50" stroke-width="18"/><path d="M200 220q-20-110 65-110q70 0 80 65z" fill="#f4c367"/><ellipse cx="266" cy="198" rx="85" ry="20" fill="#fff2c7" transform="rotate(-17 266 198)"/>'],
    ['服饰配件', '#e8eee9', '<path d="M120 270l45-130 70 30 40 65 105 35q30 30-5 52H133q-35-13-13-52" fill="#e7ebe8" stroke="#7b9c90" stroke-width="5"/><path d="M160 192l85 32m-95-6 110 30m-125 49h240" stroke="#7b9c90" stroke-width="9"/><path d="M280 265l55-17" stroke="#de9a6c" stroke-width="16"/>'],
    ['数码电子', '#e8e5dc', '<path d="M135 270v-70a115 115 0 0 1 230 0v70" fill="none" stroke="#4d625d" stroke-width="34"/><rect x="107" y="220" width="70" height="120" rx="30" fill="#95aca0"/><rect x="323" y="220" width="70" height="120" rx="30" fill="#95aca0"/><path d="M138 235v88m220-88v88" stroke="#dbe2d6" stroke-width="7"/>'],
    ['运动户外', '#edf0dc', '<ellipse cx="235" cy="170" rx="80" ry="110" fill="#f4f2d9" stroke="#587b67" stroke-width="13" transform="rotate(22 235 170)"/><path d="M175 120l100 90m-115-50 100 90m-50-150 90 80M170 230l100-120m-70 150 100-120" stroke="#b7bd9a" stroke-width="3"/><path d="M198 265l-50 115" stroke="#587b67" stroke-width="17"/><circle cx="335" cy="325" r="28" fill="#ddd98d"/>']
  ];
  const titles = ['高数与线代教材，给下一位同学', '复古数码相机，记录校园日常', '暖光阅读台灯，陪你认真读书', '浅色休闲鞋 · 39 码', '头戴式耳机，通勤自习好搭子', '羽毛球拍，操场见！'];
  const prices = [1800, 28000, 3500, 4500, 8500, 5500];
  const description = '这是静态演示商品，不是真实在售物品。\n这里会展示成色、使用情况、已知瑕疵和配件说明。发布自己的闲置时，请如实描述。';
  const categories = ['教材书籍', '数码电子', '宿舍好物', '服饰配件', '运动户外'];
  const accounts = { seller: { name: '小林同学' }, buyer: { name: '小陈同学' } };

  const blobCache = new Map();
  const photoUrl = src => {
    if (!src.startsWith('svg:')) return src;
    const i = Number(src.slice(4));
    if (!blobCache.has(i)) blobCache.set(i, URL.createObjectURL(new Blob([svgUri(art[i])], { type: 'image/svg+xml' })));
    return blobCache.get(i);
  };

  function seedState() {
    return {
      seq: 0, sessions: {}, adminSession: null,
      favorites: { seller: [], buyer: [] }, reports: [], uploads: {},
      products: titles.map((title, i) => ({
        id: `seed-${i + 1}`, ownerId: 'seller', title, description, category: art[i][0],
        quantity: 1, cents: prices[i], delivery: 'pickup', location: '图书馆门口（演示地点）',
        contact_type: 'wechat', contact_value: 'demo_not_real', status: 'active', review_note: '',
        created_at: Date.now() - i * 3600000, photos: [{ id: `seed-media-${i + 1}`, src: `svg:${i}` }]
      }))
    };
  }
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && Array.isArray(s.products) ? s : null; } catch { return null; } };
  let state = load() || seedState();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 超出配额时仅保留在当前页面内存 */ } };
  save();

  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const ok = data => json(200, data);
  const fail = (status, error) => json(status, { error });
  const bearer = request => {
    const header = request.headers.get('Authorization');
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  };
  const me = request => bearer(request) ? state.sessions[bearer(request)] ?? null : null;
  const findProduct = id => state.products.find(p => p.id === id);
  const toCard = (p, account) => ({
    id: p.id, title: p.title, description: p.description, category: p.category, quantity: p.quantity,
    price: p.cents / 100, delivery: p.delivery, location: p.location, status: p.status, review_note: p.review_note,
    seller_name: accounts[p.ownerId]?.name || '校园同学', created_at: p.created_at,
    photos: p.photos.map(ph => ({ id: ph.id, url: photoUrl(ph.src) })),
    is_favorite: account ? state.favorites[account]?.includes(p.id) ?? false : false
  });
  const byNewest = (a, b) => b.created_at - a.created_at;
  const validPhotoList = ids => {
    const photos = (ids || []).map(id => state.uploads[id]).filter(Boolean).map(u => ({ id: u.id, src: u.src }));
    return photos.length ? photos : null;
  };

  function validateDraft(data) {
    const title = String(data.title || '').trim();
    const cents = Math.round(Number(data.price) * 100);
    if (title.length < 2 || title.length > 40) return '商品名称需要 2–40 字';
    if (!String(data.description || '').trim()) return '请填写商品简介';
    if (!categories.includes(data.category)) return '请选择商品分类';
    if (!Number.isFinite(cents) || cents <= 0) return '请填写正确的单价';
    if (data.delivery === 'pickup' && !String(data.location || '').trim()) return '自取地点必填';
    if (!String(data.contact_value || '').trim()) return '请填写联系方式';
    if (!data.contact_consent) return '需要同意展示联系方式后才能发布';
    return null;
  }

  async function handle(request, pathname) {
    const route = pathname.replace(/^\/api/, '') || '/';
    const method = request.method;
    const account = me(request);

    if (route === '/config' && method === 'GET') return ok({ schoolName: '青集 · 校园闲置（在线演示）', demo: true, categories });

    if (route === '/auth/demo' && method === 'POST') {
      const { account: name } = await request.json().catch(() => ({}));
      if (!accounts[name]) return fail(400, '演示身份不存在');
      const token = `session-${Math.random().toString(36).slice(2)}`;
      state.sessions[token] = name;
      save();
      return ok({ token, user: accounts[name] });
    }
    if (route === '/auth/admin' && method === 'POST') {
      const { password } = await request.json().catch(() => ({}));
      if (password !== 'demo-admin-2026') return fail(401, '密码不正确');
      state.adminSession = `admin-${Math.random().toString(36).slice(2)}`;
      save();
      return ok({ token: state.adminSession });
    }
    if (route === '/auth/logout' && method === 'POST') {
      const token = bearer(request);
      if (token && state.sessions[token]) { delete state.sessions[token]; save(); }
      if (token && token === state.adminSession) { state.adminSession = null; save(); }
      return ok({ ok: true });
    }
    if (route === '/me' && method === 'GET') return account ? ok(accounts[account]) : fail(401, '请重新登录');

    if (route === '/products' && method === 'GET') {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const category = url.searchParams.get('category') || '';
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const PAGE_SIZE = 12;
      let items = state.products.filter(p => p.status === 'active');
      if (category) items = items.filter(p => p.category === category);
      if (q) items = items.filter(p => (p.title + p.description).toLowerCase().includes(q));
      items = items.slice().sort(byNewest);
      const total = items.length;
      const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return ok({ items: slice.map(p => toCard(p, account)), total, hasMore: page * PAGE_SIZE < total });
    }
    if (route === '/products' && method === 'POST') {
      if (!account) return fail(401, '请先登录');
      const data = await request.json().catch(() => ({}));
      const invalid = validateDraft(data);
      if (invalid) return fail(400, invalid);
      const photos = validPhotoList(data.photo_ids);
      if (!photos) return fail(400, '至少上传 1 张照片');
      const product = {
        id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: account, title: String(data.title).trim(), description: String(data.description).trim(),
        category: data.category, quantity: Math.min(999, Math.max(1, Math.round(Number(data.quantity) || 1))),
        cents: Math.round(Number(data.price) * 100), delivery: data.delivery === 'delivery' ? 'delivery' : 'pickup',
        location: String(data.location || '').trim(), contact_type: data.contact_type === 'phone' ? 'phone' : 'wechat',
        contact_value: String(data.contact_value).trim(), status: 'pending', review_note: '',
        created_at: Date.now(), photos
      };
      state.products.push(product);
      save();
      return json(201, { id: product.id });
    }
    if (route === '/mine' && method === 'GET') {
      if (!account) return fail(401, '请先登录');
      const items = state.products.filter(p => p.ownerId === account).sort(byNewest).map(p => toCard(p, account));
      return ok({ items, total: items.length, hasMore: false });
    }
    if (route === '/favorites' && method === 'GET') {
      if (!account) return fail(401, '请先登录');
      const items = (state.favorites[account] || []).map(id => findProduct(id)).filter(Boolean).sort(byNewest)
        .map(p => p.status === 'active' ? toCard(p, account) : { id: p.id, title: p.title, unavailable: true });
      return ok({ items, total: items.length, hasMore: false });
    }

    const productMatch = route.match(/^\/products\/([^/]+)(\/.*)?$/);
    if (productMatch) {
      const p = findProduct(decodeURIComponent(productMatch[1]));
      if (!p) return fail(404, '商品不存在或已删除');
      const sub = productMatch[2] || '';
      if (!sub && method === 'GET') {
        if (p.status !== 'active' && p.ownerId !== account) return fail(404, '商品不存在或已删除');
        return ok({ ...toCard(p, account), can_contact: p.status === 'active' });
      }
      if (sub === '/favorite' && method === 'PUT') {
        if (!account) return fail(401, '请先登录');
        const list = state.favorites[account] = state.favorites[account] || [];
        if (!list.includes(p.id)) list.push(p.id);
        save();
        return ok({ ok: true });
      }
      if (sub === '/favorite' && method === 'DELETE') {
        if (!account) return fail(401, '请先登录');
        state.favorites[account] = (state.favorites[account] || []).filter(id => id !== p.id);
        save();
        return ok({ ok: true });
      }
      if (sub === '/contact' && method === 'GET') {
        if (!account) return fail(401, '请先登录');
        if (p.status !== 'active') return fail(403, '商品当前不可联系');
        return ok({ contact_type: p.contact_type, contact_value: p.contact_value, delivery: p.delivery, location: p.location });
      }
      if (sub === '/report' && method === 'POST') {
        const { reason } = await request.json().catch(() => ({}));
        if (!reason || reason.length < 2 || reason.length > 300) return fail(400, '请填写 2–300 字的举报原因');
        state.reports.push({ id: `report-${Date.now().toString(36)}`, product_id: p.id, title: p.title, reason: String(reason), created_at: Date.now(), resolved: false });
        save();
        return ok({ ok: true });
      }
      if (sub === '/status' && method === 'PATCH') {
        if (!account || p.ownerId !== account) return fail(403, '只能操作自己的商品');
        const { status } = await request.json().catch(() => ({}));
        if (!['sold', 'hidden', 'pending'].includes(status)) return fail(400, '不支持的状态');
        p.status = status;
        save();
        return ok({ ok: true });
      }
      if (!sub && method === 'PUT') {
        if (!account || p.ownerId !== account) return fail(403, '只能编辑自己的商品');
        const data = await request.json().catch(() => ({}));
        const invalid = validateDraft(data);
        if (invalid) return fail(400, invalid);
        const photos = validPhotoList(data.photo_ids);
        if (!photos) return fail(400, '至少上传 1 张照片');
        Object.assign(p, {
          title: String(data.title).trim(), description: String(data.description).trim(), category: data.category,
          quantity: Math.min(999, Math.max(1, Math.round(Number(data.quantity) || 1))),
          cents: Math.round(Number(data.price) * 100), delivery: data.delivery === 'delivery' ? 'delivery' : 'pickup',
          location: String(data.location || '').trim(), contact_type: data.contact_type === 'phone' ? 'phone' : 'wechat',
          contact_value: String(data.contact_value).trim(), status: 'pending', review_note: '', photos
        });
        save();
        return ok({ ok: true });
      }
    }

    if (route === '/uploads' && method === 'POST') {
      if (!account) return fail(401, '请先登录');
      const form = await request.formData().catch(() => null);
      const file = form?.get('photo');
      if (!(file instanceof File)) return fail(400, '请选择照片文件');
      if (file.size > 8 * 1024 * 1024) return fail(400, '每张照片不能超过 8MB');
      const id = `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('读取照片失败'));
        reader.readAsDataURL(file);
      }).catch(() => null);
      if (!src) return fail(400, '读取照片失败，请重试');
      state.uploads[id] = { id, src };
      save();
      return json(201, { id, url: src });
    }

    if (route.startsWith('/admin/')) {
      if (bearer(request) !== state.adminSession || !state.adminSession) return fail(401, '请重新登录后台');
      if (route === '/admin/products' && method === 'GET') {
        return ok({ items: state.products.slice().sort(byNewest).map(p => toCard(p, null)) });
      }
      const reviewMatch = route.match(/^\/admin\/products\/([^/]+)\/review$/);
      if (reviewMatch && method === 'POST') {
        const p = findProduct(decodeURIComponent(reviewMatch[1]));
        if (!p) return fail(404, '商品不存在');
        const { status, note } = await request.json().catch(() => ({}));
        if (!['active', 'rejected', 'hidden'].includes(status)) return fail(400, '不支持的状态');
        if (status === 'rejected' && String(note || '').trim().length < 2) return fail(400, '驳回时需要填写原因');
        p.status = status;
        p.review_note = status === 'active' ? '' : String(note || '').trim();
        save();
        return ok({ ok: true });
      }
      if (route === '/admin/reports' && method === 'GET') return ok({ items: state.reports.slice().sort((a, b) => b.created_at - a.created_at) });
      const resolveMatch = route.match(/^\/admin\/reports\/([^/]+)$/);
      if (resolveMatch && method === 'PATCH') {
        const report = state.reports.find(r => r.id === decodeURIComponent(resolveMatch[1]));
        if (!report) return fail(404, '举报不存在');
        report.resolved = true;
        save();
        return ok({ ok: true });
      }
    }

    return fail(404, '静态演示未提供该接口');
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input, location.href) : new URL(input.url);
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return handle(input instanceof Request && input.url ? input : new Request(url.href, init), url.pathname);
      }
    } catch { /* 回退到原始 fetch */ }
    return originalFetch(input, init);
  };
})();
