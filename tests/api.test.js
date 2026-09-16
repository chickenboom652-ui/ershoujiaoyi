import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { openStore } from '../server/store.js';
import { createApp } from '../server/app.js';

let server, db, base, seller, buyer, admin, photo;
const dir = mkdtempSync(join(tmpdir(), 'campus-market-test-'));
async function request(path, method = 'GET', body, token) {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}
async function upload(token, data, type = 'image/png') {
  const form = new FormData(); form.append('photo', new Blob([data], { type }), 'photo.png');
  const response = await fetch(base + '/api/uploads', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: response.status, body: await response.json() };
}
const draft = changes => ({ title: '二手高等数学教材', description: '有少量笔记，无缺页。', category: '教材书籍', quantity: 2, price: '19.99', delivery: 'pickup', location: '图书馆门口', contact_type: 'wechat', contact_value: 'test_student', contact_consent: true, photo_ids: [photo.id], ...changes });
before(async () => {
  db = openStore(join(dir, 'test.sqlite'));
  server = createApp({ db, uploadDir: join(dir, 'uploads'), demo: true, adminPassword: 'test-password', mediaSecret: 'test-secret', rateLimits: false }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  seller = (await request('/api/auth/demo', 'POST', { account: 'seller' })).body.token;
  buyer = (await request('/api/auth/demo', 'POST', { account: 'buyer' })).body.token;
  admin = (await request('/api/auth/admin', 'POST', { password: 'test-password' })).body.token;
  const data = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#00a080' } }).png().toBuffer();
  photo = (await upload(seller, data)).body;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true }); });

test('完整交易信息流程：发布、审核、搜索、收藏、联系、已售', async () => {
  const created = await request('/api/products', 'POST', draft(), seller);
  assert.equal(created.status, 201); assert.equal(created.body.status, 'pending'); assert.equal(created.body.price, '19.99');
  const id = created.body.id;
  assert.equal((await request(`/api/products/${id}`)).status, 404);
  assert.equal((await request('/api/products?q=数学')).body.total, 0);
  assert.equal((await request(`/api/products/${id}/contact`, 'GET', undefined, buyer)).status, 409);
  assert.equal((await fetch(base + `/api/media/${photo.id}`)).status, 404);
  assert.equal((await request(`/api/admin/products/${id}/review`, 'POST', { status: 'active' }, admin)).status, 200);
  const list = await request('/api/products?q=笔记&category=' + encodeURIComponent('教材书籍'));
  assert.equal(list.body.total, 1); assert.equal(list.body.items[0].contact_value, undefined);
  assert.equal((await fetch(base + `/api/media/${photo.id}`)).status, 200);
  const detail = (await request(`/api/products/${id}`)).body;
  assert.equal(detail.description, '有少量笔记，无缺页。'); assert.equal(detail.location, undefined);
  assert.equal((await request(`/api/products/${id}/contact`)).status, 401);
  assert.equal((await request(`/api/products/${id}/contact`, 'GET', undefined, buyer)).body.contact_value, 'test_student');
  await request(`/api/products/${id}/favorite`, 'PUT', undefined, buyer);
  await request(`/api/products/${id}/favorite`, 'PUT', undefined, buyer);
  assert.equal((await request('/api/favorites', 'GET', undefined, buyer)).body.items.length, 1);
  assert.equal((await request(`/api/products/${id}/status`, 'PATCH', { status: 'sold' }, seller)).status, 200);
  assert.equal((await request('/api/products?q=数学')).body.total, 0);
  assert.equal((await request(`/api/products/${id}/contact`, 'GET', undefined, buyer)).status, 409);
  assert.equal((await request('/api/favorites', 'GET', undefined, buyer)).body.items[0].unavailable, true);
  await request(`/api/products/${id}/favorite`, 'DELETE', undefined, buyer);
  assert.equal((await request('/api/favorites', 'GET', undefined, buyer)).body.items.length, 0);
});

test('鉴权、越权、媒体所有权和审核隔离', async () => {
  assert.equal((await request('/api/products', 'POST', draft())).status, 401);
  assert.equal((await request('/api/products', 'POST', draft(), buyer)).status, 400);
  const id = (await request('/api/products', 'POST', draft(), seller)).body.id;
  assert.equal((await request(`/api/products/${id}`, 'PUT', draft({ price: '1' }), buyer)).status, 403);
  assert.equal((await request(`/api/products/${id}/status`, 'PATCH', { status: 'active' }, seller)).status, 400);
  assert.equal((await request(`/api/admin/products/${id}/review`, 'POST', { status: 'active' }, seller)).status, 401);
  await request(`/api/admin/products/${id}/review`, 'POST', { status: 'active' }, admin);
  await request(`/api/products/${id}`, 'PUT', draft({ price: '20.01' }), seller);
  assert.equal((await request(`/api/products/${id}`)).status, 404);
  assert.equal((await request(`/api/products/${id}`, 'GET', undefined, seller)).body.price, '20.01');
  assert.equal((await request('/api/admin/products')).status, 401);
});

test('字段验证、精确金额和非法图片拦截', async () => {
  for (const bad of [{ price: '0' }, { price: '1.001' }, { price: '-1' }, { quantity: 1.5 }, { quantity: 0 }, { location: '' }, { description: '' }, { photo_ids: [] }, { photo_ids: [photo.id, photo.id] }, { contact_consent: false }, { contact_type: 'phone', contact_value: '123' }, { category: '非法分类' }]) {
    assert.equal((await request('/api/products', 'POST', draft(bad), seller)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await request('/api/products', 'POST', draft({ price: '0.01', delivery: 'delivery', location: '' }), seller)).body.price, '0.01');
  assert.equal((await upload(seller, '<svg><script>alert(1)</script></svg>', 'image/svg+xml')).status, 400);
  assert.equal((await upload(undefined, 'invalid')).status, 401);
});

test('举报与管理员下架闭环，登录退出和跨站防护', async () => {
  const id = (await request('/api/products', 'POST', draft(), seller)).body.id;
  await request(`/api/admin/products/${id}/review`, 'POST', { status: 'active' }, admin);
  assert.equal((await request(`/api/products/${id}/report`, 'POST', { reason: '疑似虚假商品' }, buyer)).status, 201);
  assert.equal((await request(`/api/products/${id}/report`, 'POST', { reason: '重复举报' }, buyer)).status, 409);
  const report = (await request('/api/admin/reports', 'GET', undefined, admin)).body.items[0];
  await request(`/api/admin/products/${id}/review`, 'POST', { status: 'hidden', note: '核实期间暂时下架' }, admin);
  await request(`/api/admin/reports/${report.id}`, 'PATCH', {}, admin);
  assert.equal((await request('/api/admin/reports', 'GET', undefined, admin)).body.items[0].resolved, 1);
  assert.equal((await request(`/api/products/${id}`)).status, 404);
  const cross = await fetch(base + '/api/auth/demo', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'buyer' }) });
  assert.equal(cross.status, 403);
  const token = (await request('/api/auth/demo', 'POST', { account: 'buyer' })).body.token;
  await request('/api/auth/logout', 'POST', {}, token);
  assert.equal((await request('/api/me', 'GET', undefined, token)).status, 401);
});

test('关闭演示模式后无法使用演示登录', async () => {
  const production = createApp({ db, uploadDir: join(dir, 'uploads'), demo: false, adminPassword: 'test-password', mediaSecret: 'test-secret', rateLimits: false }).listen(0, '127.0.0.1');
  await new Promise(resolve => production.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${production.address().port}/api/auth/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'seller' }) });
    assert.equal(response.status, 403);
  } finally { await new Promise(resolve => production.close(resolve)); }
});
