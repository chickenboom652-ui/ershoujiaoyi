const api = require('../../utils/api');
Page({
  data: { demo: false, consent: false, busy: false },
  onLoad() { api.request('/config').then(c => this.setData({ demo: c.demo })).catch(api.error); },
  consent(e) { this.setData({ consent: e.detail.value.includes('yes') }); },
  policy() { wx.navigateTo({ url: '/pages/policy/policy' }); },
  async login(e) {
    if (!this.data.consent) return api.error(new Error('请先阅读并同意使用须知与隐私说明'));
    if (this.data.busy) return; this.setData({ busy: true });
    try {
      let data;
      if (e.currentTarget.dataset.account) data = await api.request('/auth/demo', { method: 'POST', data: { account: e.currentTarget.dataset.account } });
      else { const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: () => reject(new Error('微信登录失败')) })); if (!login.code) throw new Error('未能获取微信登录凭证'); data = await api.request('/auth/wechat', { method: 'POST', data: { code: login.code } }); }
      wx.setStorageSync('token', data.token); wx.setStorageSync('user', data.user); wx.navigateBack();
    } catch (error) { api.error(error); } finally { this.setData({ busy: false }); }
  }
});
