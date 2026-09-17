const api = require('../../utils/api');
Page({
  data: { searching: false, config: null, categories: ['全部好物'], category: '', query: '', items: [], page: 1, loading: false, hasMore: false, error: '' },
  onLoad() { api.request('/config').then(config => this.setData({ config, categories: ['全部好物', ...config.categories] })).catch(api.error); },
  onShow() { if(this.getTabBar)this.getTabBar()?.refresh(); this.load(false); },
  onPullDownRefresh() { this.load(false).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(true); },
  async load(append) {
    const requestId = this.requestId = (this.requestId || 0) + 1;
    const page = append ? this.data.page + 1 : 1; this.setData({ loading: true, error: '' });
    try { const data = await api.request(`/products?page=${page}&q=${encodeURIComponent(this.data.query)}&category=${encodeURIComponent(this.data.category)}`); if (requestId !== this.requestId) return; this.setData({ items: (append ? this.data.items : []).concat(data.items.map(api.product)), page, hasMore: data.hasMore }); }
    catch (error) { if (requestId === this.requestId) { this.setData({ error: error.message }); api.error(error); } }
    finally { if (requestId === this.requestId) this.setData({ loading: false }); }
  },
  focusSearch() { this.setData({ searching: true }); },
  closeSearch() { this.setData({ searching: false, query: '' }); this.load(false); },
  inputSearch(e) { this.setData({ query: e.detail.value, searching: true }); return this.load(false); },
  search() { this.load(false); },
  category(e) { this.setData({ category: e.currentTarget.dataset.index === 0 ? '' : this.data.categories[e.currentTarget.dataset.index] }); this.load(false); },
  detail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }); },
  publish() { if (api.ensureLogin()) wx.navigateTo({ url: '/pages/publish/publish' }); },
  onShareAppMessage() { return { title: '盒闲 · 让校园好物继续被喜欢', path: '/pages/home/home' }; }
});
