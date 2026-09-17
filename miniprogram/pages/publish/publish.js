const api = require('../../utils/api');
Page({
  data: { id: '', categories: [], categoryIndex: 0, deliveryOptions: ['校园自取', '卖家送达'], deliveryIndex: 0, contactOptions: ['微信号', '手机号'], contactIndex: 0, photos: [], title: '', description: '', quantity: '1', price: '', location: '', contact_value: '', consent: false, busy: false, uploading: false, ready: false, error: '' },
  async onLoad(options) {
    if (!api.ensureLogin()) return;
    try { const config = await api.request('/config'); this.setData({ categories: config.categories }); if (options.id) { const p = api.product(await api.request('/products/' + options.id)); if (!p.is_owner) throw new Error('只能编辑自己的商品'); this.setData({ id: p.id, title: p.title, description: p.description, quantity: String(p.quantity), price: p.price, location: p.location, contact_value: p.contact_value, photos: p.photos, categoryIndex: config.categories.indexOf(p.category), deliveryIndex: p.delivery === 'delivery' ? 1 : 0, contactIndex: p.contact_type === 'phone' ? 1 : 0 }); } this.setData({ ready: true }); }
    catch (error) { this.setData({ error: error.message }); api.error(error); }
  },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  pick(e) { this.setData({ [e.currentTarget.dataset.field]: Number(e.detail.value) }); },
  consent(e) { this.setData({ consent: e.detail.value.includes('yes') }); },
  removePhoto(e) { if (this.data.uploading || this.data.busy) return; const photos = this.data.photos.slice(); photos.splice(e.currentTarget.dataset.index, 1); this.setData({ photos }); },
  async addPhoto() {
    if (this.data.uploading || this.data.busy || this.data.photos.length >= 6) return;
    try {
      const result = await new Promise((resolve, reject) => wx.chooseMedia({ count: 6 - this.data.photos.length, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject }));
      this.setData({ uploading: true });
      for (const file of result.tempFiles.slice(0, 6 - this.data.photos.length)) { if (file.size > 8 * 1024 * 1024) throw new Error('每张照片不能超过 8MB'); const photo = await api.upload(file.tempFilePath); this.setData({ photos: this.data.photos.concat(photo) }); }
    } catch (error) { if (!String(error.errMsg || '').includes('cancel')) api.error(error); }
    finally { this.setData({ uploading: false }); }
  },
  async submit() {
    if (this.data.busy || this.data.uploading || !this.data.ready) return; if (!api.ensureLogin()) return;
    this.setData({ busy: true, error: '' });
    try { const d = this.data; await api.request(d.id ? '/products/' + d.id : '/products', { method: d.id ? 'PUT' : 'POST', data: { title: d.title, description: d.description, category: d.categories[d.categoryIndex], quantity: Number(d.quantity), price: d.price, delivery: d.deliveryIndex ? 'delivery' : 'pickup', location: d.location, contact_type: d.contactIndex ? 'phone' : 'wechat', contact_value: d.contact_value, contact_consent: d.consent, photo_ids: d.photos.map(p => p.id) } }); wx.showToast({ title: '已提交审核', icon: 'success' }); wx.switchTab({ url: '/pages/mine/mine' }); }
    catch (error) { this.setData({ error: error.message }); api.error(error); } finally { this.setData({ busy: false }); }
  }
});
