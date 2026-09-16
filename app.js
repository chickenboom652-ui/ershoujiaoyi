const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let config, user, token = localStorage.getItem('campus-token'), category = '', page = 1, hasMore = false, query = '', route = '', renderId = 0, draftPhotos = [], editingId = null, uploading = false;
const statuses = { active: '展示中', pending: '待审核', rejected: '未通过', hidden: '已下架', sold: '已售出' };
async function api(path, options = {}) {
  const response = await fetch('/api' + path, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) { token = null; user = null; localStorage.removeItem('campus-token'); updateUser(); } throw new Error(data.error || '请求失败'); }
  return data;
}
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').hidden = true, 3500); }
function showDialog(html) { $('#dialog-body').innerHTML = html; if (!$('#dialog').open) $('#dialog').showModal(); }
function updateUser() { $('#user-name').textContent = user?.name || '登录校园账号'; }
function age(time) { const h = Math.max(0, Math.floor((Date.now() - time) / 3600000)); return h < 1 ? '刚刚发布' : h < 24 ? `${h} 小时前` : `${Math.floor(h / 24)} 天前`; }
function card(p) {
  if (p.unavailable) return `<article class="product-card"><div class="empty"><span class="empty-icon">▤</span><strong>${esc(p.title)}</strong><p>商品已售出、下架或重新审核</p><button class="secondary" data-action="unfavorite" data-id="${p.id}">取消收藏</button></div></article>`;
  return `<article class="product-card"><a href="#detail/${p.id}" class="card-image-link"><img class="card-photo" src="${esc(p.photos[0]?.url || '')}" alt="${esc(p.title)}" loading="lazy">${route === 'mine' ? `<span class="card-status">${statuses[p.status]}</span>` : `<span class="delivery-tag">${p.delivery === 'pickup' ? '校园自取' : '支持送达'}</span>`}</a>${p.status === 'active' ? `<button class="favorite-button ${p.is_favorite ? 'saved' : ''}" data-action="${p.is_favorite ? 'unfavorite' : 'favorite'}" data-id="${p.id}" aria-label="${p.is_favorite ? '取消收藏' : '收藏商品'}">${p.is_favorite ? '♥' : '♡'}</button>` : ''}<div class="card-body"><a href="#detail/${p.id}"><h3>${esc(p.title)}</h3></a><div class="card-pricing"><span class="price"><small>¥</small>${esc(Number(p.price))}</span><span class="category-caption">${esc(p.category)}</span></div><div class="card-meta"><span class="avatar">同</span><span>${esc(p.seller_name)}</span><time>${age(p.created_at)}</time></div></div>${p.review_note ? `<div class="review-note">审核说明：${esc(p.review_note)}</div>` : ''}${route === 'mine' ? `<div class="card-actions"><button data-action="edit" data-id="${p.id}">编辑</button>${p.status === 'active' ? `<button data-action="sold" data-id="${p.id}">标记已售</button>` : ''}${['active', 'pending'].includes(p.status) ? `<button data-action="hidden" data-id="${p.id}">下架</button>` : `<button data-action="pending" data-id="${p.id}">重新送审</button>`}</div>` : ''}</article>`;
}
function loginDialog() {
  if (user) { showDialog(`<div class="login-content"><span class="brand-mark">青</span><h2>${esc(user.name)}</h2><p class="muted">把闲置分享给需要它的人。</p><button class="secondary" data-action="logout">退出登录</button></div>`); return; }
  showDialog(`<div class="login-content"><span class="brand-mark">青</span><h2 class="dialog-heading">欢迎来到青集</h2><p class="muted">登录后，发布闲置、收藏好物，<br>与同校同学取得联系。</p>${config.demo ? '<button class="primary" data-action="login" data-account="seller">以小林同学体验 · 卖家</button><button class="secondary" data-action="login" data-account="buyer">以小陈同学体验 · 买家</button><p class="muted">仅本机演示身份，不代表微信或校园认证。</p>' : '<p>请在微信小程序中使用微信登录。</p>'}<a href="policy.html" class="text-button" target="_blank">使用须知与隐私说明</a></div>`);
}
function ensureUser() { if (user) return true; loginDialog(); return false; }
async function renderFeed(append = false) {
  const current = ++renderId;
  if (!append) { page = 1; $('#feed').innerHTML = '<div class="empty">正在寻找校园好物…</div>'; }
  $('#load-more').hidden = true;
  if (route !== 'home' && !user) { $('#feed').innerHTML = '<div class="empty"><span class="empty-icon">♡</span><strong>登录后，找到属于你的好物</strong><p>你的发布和收藏都会保存在这里。</p><button class="primary" data-action="show-login">登录账号</button></div>'; $('#item-count').textContent = ''; return; }
  try {
    const data = await api(route === 'home' ? `/products?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&page=${page}` : route === 'mine' ? '/mine' : '/favorites');
    if (current !== renderId) return;
    hasMore = Boolean(data.hasMore); $('#load-more').hidden = !hasMore;
    $('#item-count').textContent = `${data.total ?? data.items.length} 件好物`;
    const html = data.items.map(card).join('');
    if (append) $('#feed').insertAdjacentHTML('beforeend', html); else $('#feed').innerHTML = html || `<div class="empty"><span class="empty-icon">${route === 'favorites' ? '♡' : '↗'}</span><strong>${route === 'home' ? '暂时没有找到相关好物' : route === 'mine' ? '你的第一件闲置，正等着出发' : '遇到心动好物，点一下爱心'}</strong><p>${route === 'home' ? '换个关键词，或者看看其他分类。' : '让闲置遇到需要它的同学。'}</p>${route === 'mine' ? '<button class="primary" data-action="publish">发布第一件闲置</button>' : ''}</div>`;
  } catch (error) { if (current === renderId) $('#feed').innerHTML = `<div class="empty"><strong>暂时没能加载</strong><p>${esc(error.message)}</p><button class="secondary" data-action="retry">重新加载</button></div>`; }
}
async function navigate() {
  const hash = location.hash.slice(1) || 'home';
  if (hash.startsWith('detail/')) { if (!route) { route = 'home'; await setRoute(); } await detail(hash.slice(7)); return; }
  if ($('#dialog').open) $('#dialog').close();
  route = ['home', 'mine', 'favorites'].includes(hash) ? hash : 'home'; await setRoute();
}
async function setRoute() {
  document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === route));
  $('#home-intro').hidden = route !== 'home'; $('#search-form').hidden = route !== 'home'; $('#filter-row').hidden = route !== 'home';
  $('#section-title').innerHTML = `${{ home: '发现校园好物', mine: '我的发布', favorites: '我的收藏' }[route]} <span id="item-count"></span>`;
  $('#page-label').textContent = { home: '闲置集市', mine: '我的发布', favorites: '我的收藏' }[route];
  $('#section-eyebrow').textContent = { home: 'THE CAMPUS EDIT', mine: 'A NEW CHAPTER', favorites: 'YOUR GOOD FINDS' }[route];
  await renderFeed();
}
async function detail(id) {
  try {
    const p = await api('/products/' + encodeURIComponent(id));
    showDialog(`<div class="detail-layout"><div><img id="detail-image" class="detail-image" src="${esc(p.photos[0]?.url)}" alt="${esc(p.title)}"><div class="thumbnails">${p.photos.map(photo => `<button data-action="photo" data-src="${esc(photo.url)}" aria-label="查看商品照片"><img src="${esc(photo.url)}" alt="商品缩略图"></button>`).join('')}</div></div><div class="detail-info"><span class="eyebrow">${esc(p.category)} · ${statuses[p.status]}</span><h2>${esc(p.title)}</h2><span class="price"><small>¥</small>${esc(Number(p.price))}</span><div class="detail-facts"><span>数量 ${p.quantity}</span><span>${p.delivery === 'pickup' ? '校园自取' : '支持送达'}</span><span>无平台佣金</span></div><h4>关于这件好物</h4><p class="description">${esc(p.description)}</p><div class="card-meta"><span class="avatar">同</span>${esc(p.seller_name)}<time>${age(p.created_at)}</time></div>${p.review_note ? `<p class="muted">审核说明：${esc(p.review_note)}</p>` : ''}<div class="detail-actions">${p.can_contact ? `<button class="primary" data-action="contact" data-id="${p.id}">联系卖家 ↗</button><button class="secondary" data-action="${p.is_favorite ? 'unfavorite' : 'favorite'}" data-id="${p.id}" data-detail="true">${p.is_favorite ? '♥ 已收藏' : '♡ 收藏'}</button>` : '<p class="muted">商品尚未公开展示或已结束售卖。</p>'}</div><div id="contact-box"></div><p class="muted">当面验货，自行协商付款。请勿提前支付陌生人定金。</p>${p.status === 'active' ? `<button class="text-button" data-action="report" data-id="${p.id}">举报此商品</button>` : ''}</div></div>`);
  } catch (error) { toast(error.message); history.replaceState(null, '', '#' + (route || 'home')); }
}
function renderPhotos() {
  $('#photo-list').innerHTML = draftPhotos.map((p, i) => `<div class="photo-preview"><img src="${esc(p.url)}" alt="待发布照片"><button type="button" data-action="remove-photo" data-index="${i}" aria-label="移除照片">×</button></div>`).join('') + (draftPhotos.length < 6 ? '<label class="upload-button"><b>＋</b><span>添加照片</span><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>' : '');
}
async function publish(id) {
  if (!ensureUser()) return;
  let p = {}; if (id) p = await api('/products/' + id);
  editingId = id || null; draftPhotos = p.photos || [];
  showDialog(`<span class="eyebrow">LET GOOD THINGS CIRCULATE</span><h2 class="dialog-heading">${id ? '编辑这件好物' : '给闲置一次新的出发'}</h2><p class="muted">真实描述，放心交换。提交后经审核公开展示。</p><form id="publish-form" class="publish-form"><label class="field">商品照片 <span class="muted">1–6 张 · 每张不超过 8MB</span></label><div id="photo-list" class="photo-uploader"></div><label class="field">商品名称<input name="title" required minlength="2" maxlength="40" placeholder="例如：九成新护眼台灯" value="${esc(p.title)}"></label><label class="field">商品简介<textarea name="description" required maxlength="1000" placeholder="说说成色、使用时间、瑕疵和配件，让同学更了解这件好物。">${esc(p.description)}</textarea></label><div class="field-row"><label class="field">分类<select name="category">${config.categories.map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="field">商品数量<input name="quantity" type="number" min="1" max="999" step="1" value="${p.quantity || 1}" required></label></div><div class="field-row"><label class="field">单价（元）<input name="price" type="number" min="0.01" max="999999" step="0.01" placeholder="0.00" value="${esc(p.price)}" required></label><label class="field">交付方式<select name="delivery" id="delivery"><option value="pickup">校园自取</option><option value="delivery" ${p.delivery === 'delivery' ? 'selected' : ''}>卖家送达</option></select></label></div><label class="field"><span id="location-label">${p.delivery === 'delivery' ? '送达范围 / 说明（选填）' : '自取交接地点（必填）'}</span><input name="location" id="location" maxlength="120" placeholder="建议选择图书馆、食堂门口等公共地点" value="${esc(p.location)}" ${p.delivery !== 'delivery' ? 'required' : ''}></label><div class="field-row"><label class="field">联系类型<select name="contact_type"><option value="wechat">微信号</option><option value="phone" ${p.contact_type === 'phone' ? 'selected' : ''}>手机号</option></select></label><label class="field">联系方式<input name="contact_value" required minlength="3" maxlength="50" value="${esc(p.contact_value)}" placeholder="供有意向的同学联系"></label></div><label class="consent"><input type="checkbox" name="consent" required>我同意向登录用户展示所填联系方式和交接地点，并确认图片、描述真实，有权出售该物品。</label><div class="form-footer"><span class="muted">免费发布，无佣金。编辑后会重新审核。</span><button class="primary" type="submit">提交审核 ↗</button></div><p id="form-error" class="error-inline" role="alert"></p></form>`);
  $('#publish-form').querySelectorAll('select').forEach(select => select.setAttribute('aria-label', select.parentElement.firstChild.textContent.trim()));
  renderPhotos();
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'show-login') return loginDialog();
    if (action === 'login') { button.disabled = true; const data = await api('/auth/demo', { method: 'POST', body: JSON.stringify({ account: button.dataset.account }) }); token = data.token; user = data.user; localStorage.setItem('campus-token', token); updateUser(); $('#dialog').close(); await renderFeed(); toast('登录成功'); return; }
    if (action === 'logout') { await api('/auth/logout', { method: 'POST', body: '{}' }); token = null; user = null; localStorage.removeItem('campus-token'); updateUser(); $('#dialog').close(); await renderFeed(); return; }
    if (action === 'retry') return renderFeed();
    if (action === 'photo') { $('#detail-image').src = button.dataset.src; return; }
    if (action === 'publish' || action === 'edit') return await publish(id);
    if (action === 'remove-photo') { if (uploading) return; draftPhotos.splice(Number(button.dataset.index), 1); renderPhotos(); return; }
    if (!ensureUser()) return;
    button.disabled = true;
    if (action === 'favorite' || action === 'unfavorite') { await api(`/products/${id}/favorite`, { method: action === 'favorite' ? 'PUT' : 'DELETE' }); toast(action === 'favorite' ? '已加入我的收藏' : '已取消收藏'); if (button.dataset.detail) await detail(id); await renderFeed(); }
    if (['sold', 'hidden', 'pending'].includes(action)) { if (!confirm({ sold: '确认这件物品已线下售出？', hidden: '确认下架这件物品？', pending: '重新提交审核后才会公开展示，继续吗？' }[action])) return; await api(`/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: action }) }); await renderFeed(); toast('商品状态已更新'); }
    if (action === 'contact') { const c = await api(`/products/${id}/contact`); $('#contact-box').innerHTML = `<div class="contact-box">${c.contact_type === 'wechat' ? '微信号' : '手机号'}：${esc(c.contact_value)}<br>${c.delivery === 'pickup' ? '自取地点' : '送达说明'}：${esc(c.location || '请与卖家协商')}</div>`; }
    if (action === 'report') { const reason = prompt('请描述举报原因（2–300 字），管理员会核实处理。'); if (reason) { await api(`/products/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) }); toast('举报已提交，感谢你维护校园集市'); } }
  } catch (error) { toast(error.message); } finally { button.disabled = false; }
});
document.addEventListener('change', async event => {
  if (event.target.id === 'delivery') { const pickup = event.target.value === 'pickup'; $('#location-label').textContent = pickup ? '自取交接地点（必填）' : '送达范围 / 说明（选填）'; $('#location').required = pickup; }
  if (event.target.id !== 'photo-input') return;
  const files = [...event.target.files]; if (files.length + draftPhotos.length > 6) { toast('最多上传 6 张照片'); return; }
  uploading = true; const submit = $('#publish-form button[type=submit]'); submit.disabled = true;
  try { for (const file of files) { if (file.size > 8 * 1024 * 1024) throw new Error('每张照片不能超过 8MB'); const form = new FormData(); form.append('photo', file); draftPhotos.push(await api('/uploads', { method: 'POST', body: form })); } }
  catch (error) { toast(error.message); } finally { uploading = false; if ($('#photo-list')) renderPhotos(); if (submit) submit.disabled = false; }
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'publish-form') return; event.preventDefault(); if (uploading) return;
  const form = event.target; const button = form.querySelector('button[type=submit]'); button.disabled = true; $('#form-error').textContent = '';
  try { const f = new FormData(form); const data = Object.fromEntries(f); data.quantity = Number(data.quantity); data.contact_consent = f.get('consent') === 'on'; data.photo_ids = draftPhotos.map(p => p.id); await api(editingId ? `/products/${editingId}` : '/products', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(data) }); $('#dialog').close(); toast('已提交审核，通过后同学们就能看见了'); if (location.hash === '#mine') await renderFeed(); else location.hash = 'mine'; }
  catch (error) { $('#form-error').textContent = error.message; } finally { button.disabled = false; }
});
$('#search-form').addEventListener('submit', event => { event.preventDefault(); query = $('#search').value.trim(); renderFeed(); });
$('#categories').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (!button) return; category = button.dataset.category; document.querySelectorAll('.category').forEach(el => el.classList.toggle('selected', el === button)); renderFeed(); });
$('#load-more').addEventListener('click', async () => { if (hasMore) { $('#load-more').disabled = true; page++; await renderFeed(true); $('#load-more').disabled = false; } });
$('#user-button').addEventListener('click', loginDialog);
$('#publish-button').addEventListener('click', () => publish().catch(error => toast(error.message)));
$('.close-dialog').addEventListener('click', () => $('#dialog').close());
$('#dialog').addEventListener('close', () => { if (location.hash.startsWith('#detail/')) history.replaceState(null, '', '#' + (route || 'home')); });
window.addEventListener('hashchange', navigate);
(async () => { try { config = await api('/config'); $('#school').textContent = config.schoolName; $('#demo-banner').hidden = !config.demo; $('#categories').innerHTML = ['', ...config.categories].map(c => `<button class="category ${!c ? 'selected' : ''}" data-category="${esc(c)}">${c || '全部好物'}</button>`).join(''); if (token) try { user = await api('/me'); } catch { token = null; localStorage.removeItem('campus-token'); } updateUser(); await navigate(); } catch (error) { $('#feed').innerHTML = `<div class="empty">${esc(error.message)}，请刷新重试。</div>`; } })();
