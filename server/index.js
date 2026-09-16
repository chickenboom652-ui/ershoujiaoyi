import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openStore } from './store.js';
import { createApp } from './app.js';
import { seedDemo } from './seed.js';

const demo = process.argv.includes('--demo');
if (demo && process.env.NODE_ENV === 'production') throw new Error('生产环境禁止演示登录');
if (!demo && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16 || !process.env.MEDIA_SECRET || process.env.MEDIA_SECRET.length < 32 || !process.env.WX_APP_ID || !process.env.WX_APP_SECRET)) throw new Error('生产启动需配置 ADMIN_PASSWORD(至少16字符)、MEDIA_SECRET(至少32字符)、WX_APP_ID、WX_APP_SECRET。仅本机体验请用 npm run dev。');
const db = openStore(resolve(process.env.DATA_DIR || (demo ? 'data/demo' : 'data/production'), 'market.sqlite'));
const uploadDir = resolve(process.env.UPLOAD_DIR || (demo ? 'data/demo/uploads' : 'data/production/uploads'));
if (demo) await seedDemo(db, uploadDir);
const app = createApp({ db, uploadDir, demo, adminPassword: demo ? 'demo-admin-2026' : process.env.ADMIN_PASSWORD, mediaSecret: process.env.MEDIA_SECRET || randomBytes(32).toString('hex'), wxAppId: process.env.WX_APP_ID, wxAppSecret: process.env.WX_APP_SECRET, schoolName: process.env.SCHOOL_NAME || '校园闲置', trustProxy: process.env.TRUST_PROXY === '1' });
const host = demo ? '127.0.0.1' : process.env.HOST || '127.0.0.1';
const server = app.listen(Number(process.env.PORT || 3000), host, () => {
  console.log(`校园闲置已启动：http://${host}:${server.address().port}`);
  if (demo) console.log('本机演示模式；管理入口 /admin.html；演示密码 demo-admin-2026。示例商品为虚构演示数据。');
});
const shutdown = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
