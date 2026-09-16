App({
  globalData: { config: null },
  onLaunch() { require('./utils/api').request('/config').then(config => { this.globalData.config = config; }).catch(() => {}); }
});
