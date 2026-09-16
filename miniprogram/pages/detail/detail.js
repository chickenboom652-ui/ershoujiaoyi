const api = require('../../utils/api');
Page({
  data: { id: '', product: null, contact: null, loading: true, error: '', busy: false },
  onLoad(options) { this.setData({ id: options.id || '' }); },
  onShow() { this.load(); },
  async load() { this.setData({ loading: true, contact: null }); try { const product = api.product(await api.request('/products/' + encodeURIComponent(this.data.id))); this.setData({ product, error: '' }); } catch (error) { this.setData({ error: error.message, product: null }); } finally { this.setData({ loading: false }); } },
  preview(e) { wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.product.photos.map(p => p.url) }); },
  async favorite() { if (!api.ensureLogin() || this.data.busy) return; this.setData({ busy: true }); try { const p = this.data.product; await api.request(`/products/${p.id}/favorite`, { method: p.is_favorite ? 'DELETE' : 'PUT' }); this.setData({ 'product.is_favorite': !p.is_favorite }); } catch (error) { api.error(error); } finally { this.setData({ busy: false }); } },
  async contact() { if (!api.ensureLogin()) return; try { this.setData({ contact: await api.request(`/products/${this.data.id}/contact`) }); } catch (error) { api.error(error); } },
  copyContact() { wx.setClipboardData({ data: this.data.contact.contact_value }); },
  report() { if (!api.ensureLogin()) return; wx.showModal({ title: '举报商品', editable: true, placeholderText: '请描述举报原因（2–300 字）', success: async result => { if (!result.confirm) return; try { await api.request(`/products/${this.data.id}/report`, { method: 'POST', data: { reason: result.content } }); wx.showToast({ title: '已提交举报', icon: 'success' }); } catch (error) { api.error(error); } } }); },
  onShareAppMessage() { return { title: this.data.product ? this.data.product.title : '校园闲置', path: '/pages/detail/detail?id=' + this.data.id }; }
});
