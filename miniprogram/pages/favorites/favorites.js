const api = require('../../utils/api');
Page({
  data: { items: [], loggedIn: false, loading: false, error: '' },
  onShow() { this.setData({ loggedIn: Boolean(wx.getStorageSync('token')) }); this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() { if (!wx.getStorageSync('token')) { this.setData({ items: [], loggedIn: false }); return; } this.setData({ loading: true, error: '' }); try { const data = await api.request('/favorites'); this.setData({ items: data.items.map(api.product) }); } catch (error) { this.setData({ error: error.message, loggedIn: Boolean(wx.getStorageSync('token')) }); api.error(error); } finally { this.setData({ loading: false }); } },
  login() { wx.navigateTo({ url: '/pages/login/login' }); },
  detail(e) { if (e.currentTarget.dataset.unavailable) return; wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }); },
  async remove(e) { try { await api.request(`/products/${e.currentTarget.dataset.id}/favorite`, { method: 'DELETE' }); await this.load(); } catch (error) { api.error(error); } }
});
