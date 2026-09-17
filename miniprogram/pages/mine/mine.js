const api = require('../../utils/api');
Page({
  data: { viewingPublished: false, user: null, items: [], loading: false, error: '', busy: false },
  onShow() { if(this.getTabBar)this.getTabBar()?.refresh(); this.setData({ user: wx.getStorageSync('user') || null }); if (wx.getStorageSync('token')) this.load(); else this.setData({ items: [] }); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  showPublished() { this.setData({ viewingPublished: true }); },
  favorites() { wx.navigateTo({url:'/pages/favorites/favorites'}); },
  login() { wx.navigateTo({ url: '/pages/login/login' }); },
  async load() { if (!wx.getStorageSync('token')) return; this.setData({ loading: true, error: '' }); try { const data = await api.request('/mine'); this.setData({ items: data.items.map(api.product) }); } catch (error) { this.setData({ error: error.message, user: wx.getStorageSync('user') || null }); api.error(error); } finally { this.setData({ loading: false }); } },
  publish() { if (api.ensureLogin()) wx.navigateTo({ url: '/pages/publish/publish' }); },
  edit(e) { wx.navigateTo({ url: '/pages/publish/publish?id=' + e.currentTarget.dataset.id }); },
  detail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }); },
  status(e) { if (this.data.busy) return; const { id, status } = e.currentTarget.dataset; wx.showModal({ title: '更新商品状态', content: status === 'sold' ? '确认已线下售出？' : status === 'hidden' ? '确认下架这件物品？' : '重新审核通过后才会展示，继续吗？', success: async result => { if (!result.confirm) return; this.setData({ busy: true }); try { await api.request(`/products/${id}/status`, { method: 'PATCH', data: { status } }); await this.load(); } catch (error) { api.error(error); } finally { this.setData({ busy: false }); } } }); },
  async logout() { try { await api.request('/auth/logout', { method: 'POST', data: {} }); } catch (error) { api.error(error); } wx.removeStorageSync('token'); wx.removeStorageSync('user'); this.setData({ user: null, items: [] }); },
  policy() { wx.navigateTo({ url: '/pages/policy/policy' }); }
});
