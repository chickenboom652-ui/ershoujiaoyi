import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadPage(path, api, wx = {}) {
  let config;
  vm.runInNewContext(readFileSync(`miniprogram/pages/${path}/${path}.js`, 'utf8'), { require: () => api, Page: p => { config = p; }, wx, console, encodeURIComponent });
  const page = { ...config, data: structuredClone(config.data), setData(values) { Object.assign(this.data, values); } };
  return page;
}
test('小程序发布表单把原价、简介、自取地点和照片提交给真实接口', async () => {
  const calls = []; let destination;
  const page = loadPage('publish', { ensureLogin: () => true, request: async (...args) => { calls.push(args); return {}; }, error: e => { throw e; } }, { showToast() {}, switchTab: value => { destination = value.url; } });
  Object.assign(page.data, { ready: true, categories: ['教材书籍'], title: '教材转让', description: '有笔记，无缺页', price: '19.99', quantity: '2', location: '图书馆门口', contact_value: 'student_123', consent: true, photos: [{ id: 'photo-id' }] });
  await page.submit();
  const [url, options] = calls[0];
  assert.equal(url, '/products'); assert.equal(options.method, 'POST'); assert.equal(options.data.price, '19.99'); assert.equal(options.data.description, '有笔记，无缺页'); assert.equal(options.data.quantity, 2); assert.equal(options.data.location, '图书馆门口'); assert.equal(options.data.photo_ids[0], 'photo-id'); assert.equal(options.data.contact_consent, true);
  assert.equal(destination, '/pages/mine/mine'); assert.equal(page.data.busy, false);
});
test('小程序发布失败保留用户输入和错误，上传中不提交', async () => {
  let attempts = 0; const errors = [];
  const page = loadPage('publish', { ensureLogin: () => true, request: async () => { attempts++; throw new Error('自取地点必填'); }, error: e => errors.push(e.message) });
  Object.assign(page.data, { ready: true, categories: ['教材书籍'], title: '保留内容', uploading: true });
  await page.submit(); assert.equal(attempts, 0);
  page.data.uploading = false; await page.submit();
  assert.equal(page.data.title, '保留内容'); assert.equal(page.data.error, '自取地点必填'); assert.equal(page.data.busy, false); assert.equal(errors[0], '自取地点必填');
});
test('小程序搜索忽略过期响应，避免旧结果覆盖新搜索', async () => {
  const resolvers = [];
  const page = loadPage('home', { request: () => new Promise(resolve => resolvers.push(resolve)), product: p => p, error: e => { throw e; } });
  page.data.query = '旧搜索'; const first = page.load(false);
  page.data.query = '新搜索'; const second = page.load(false);
  resolvers[1]({ items: [{ id: 'new' }], hasMore: false }); await second;
  resolvers[0]({ items: [{ id: 'old' }], hasMore: true }); await first;
  assert.equal(page.data.items[0].id, 'new'); assert.equal(page.data.hasMore, false); assert.equal(page.data.loading, false);
});
test('小程序登录必须先同意说明，演示身份不冒充微信登录', async () => {
  let calls = 0; const storage = new Map(); const errors = [];
  const page = loadPage('login', { request: async url => { calls++; assert.equal(url, '/auth/demo'); return { token: 'session-token', user: { name: '演示用户' } }; }, error: e => errors.push(e.message) }, { setStorageSync: (k, v) => storage.set(k, v), navigateBack() {} });
  const event = { currentTarget: { dataset: { account: 'buyer' } } };
  await page.login(event); assert.equal(calls, 0); assert.equal(errors.length, 1);
  page.data.consent = true; await page.login(event); assert.equal(calls, 1); assert.equal(storage.get('token'), 'session-token'); assert.equal(page.data.busy, false);
});
