const $ = selector => document.querySelector(selector);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let token = sessionStorage.getItem('campus-admin-token'), tab = 'pending';
const names = { pending: '待审核', active: '展示中', rejected: '已驳回', hidden: '已下架', sold: '已售出' };
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => $('#toast').hidden = true, 4000); }
async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) { token = null; sessionStorage.removeItem('campus-admin-token'); $('#admin-login').hidden = false; $('#admin-workspace').hidden = true; } throw new Error(data.error); }
  return data;
}
async function load() {
  $('#admin-list').innerHTML = '<div class="empty">正在加载…</div>';
  const data = await api(tab === 'reports' ? '/admin/reports' : '/admin/products');
  $('#admin-login').hidden = true; $('#admin-workspace').hidden = false;
  document.querySelectorAll('[data-tab]').forEach(button => button.className = button.dataset.tab === tab ? 'primary' : 'secondary');
  if (tab === 'reports') {
    $('#admin-list').innerHTML = data.items.map(r => `<article class="admin-card"><span class="category-caption">${r.resolved ? '已处理' : '待处理'}</span><div><h3>${esc(r.title)}</h3><p>举报原因：${esc(r.reason)}</p><p class="muted">${new Date(r.created_at).toLocaleString('zh-CN')}</p>${!r.resolved ? `<button class="secondary" data-review="hidden" data-id="${r.product_id}">下架商品</button><button class="secondary" data-resolve="${r.id}">标记已处理</button>` : ''}</div></article>`).join('') || '<div class="empty">暂时没有举报</div>';
  } else {
    const items = data.items.filter(p => tab === 'all' || p.status === tab);
    $('#admin-list').innerHTML = items.map(p => `<article class="admin-card"><div>${p.photos.map(photo => `<a href="${esc(photo.url)}" target="_blank" rel="noopener"><img src="${esc(photo.url)}" alt="商品审核照片"></a>`).join('')}</div><div><span class="category-caption">${names[p.status]} · ${esc(p.category)}</span><h3>${esc(p.title)} <span class="price"><small>¥</small>${esc(p.price)}</span></h3><p>${esc(p.description)}</p><p>数量：${p.quantity} · ${p.delivery === 'pickup' ? '自取' : '送达'}：${esc(p.location)}<br>联系方式：${esc(p.contact_value)}<br>发布者：${esc(p.seller_name)}</p>${p.review_note ? `<p>审核说明：${esc(p.review_note)}</p>` : ''}${p.status === 'pending' ? `<button class="primary" data-review="active" data-id="${p.id}">通过审核</button> <button class="secondary" data-review="rejected" data-id="${p.id}">驳回并说明</button>` : ''}${p.status === 'active' ? `<button class="secondary" data-review="hidden" data-id="${p.id}">下架商品</button>` : ''}</div></article>`).join('') || '<div class="empty">这里暂时没有商品</div>';
  }
}
$('#admin-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
  try { const data = await api('/auth/admin', 'POST', { password: new FormData(event.target).get('password') }); token = data.token; sessionStorage.setItem('campus-admin-token', token); event.target.reset(); await load(); } catch (error) { notify(error.message); } finally { button.disabled = false; }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-tab],[data-review],[data-resolve]'); if (!button) return;
  button.disabled = true;
  try {
    if (button.dataset.tab) tab = button.dataset.tab;
    if (button.dataset.review) { const status = button.dataset.review; const note = status === 'active' ? '' : prompt('请填写原因（至少 2 字，卖家可见）：'); if (note === null) return; await api(`/admin/products/${button.dataset.id}/review`, 'POST', { status, note }); notify('商品状态已更新'); }
    if (button.dataset.resolve) await api('/admin/reports/' + button.dataset.resolve, 'PATCH', {});
    await load();
  } catch (error) { notify(error.message); } finally { button.disabled = false; }
});
$('#admin-logout').addEventListener('click', async () => { try { await api('/auth/logout', 'POST', {}); } finally { sessionStorage.removeItem('campus-admin-token'); location.reload(); } });
(async () => { const config = await api('/config'); if (config.demo) $('#admin-hint').textContent = '仅本机演示密码：demo-admin-2026'; if (token) try { await load(); } catch (error) { notify(error.message); } })().catch(error => notify(error.message));
