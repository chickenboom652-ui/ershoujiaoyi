const { API_BASE } = require('../config');
const base = API_BASE.replace(/\/$/, '');
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request({ url: base + '/api' + path, method: options.method || 'GET', data: options.data, timeout: 15000, header: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      success(res) { if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data); else { if (res.statusCode === 401) { wx.removeStorageSync('token'); wx.removeStorageSync('user'); } reject(new Error(res.data.error || '请求失败')); } },
      fail() { reject(new Error('无法连接服务，请检查网络与服务地址')); }
    });
  });
}
function upload(filePath) {
  return new Promise((resolve, reject) => wx.uploadFile({ url: base + '/api/uploads', filePath, name: 'photo', header: { Authorization: 'Bearer ' + wx.getStorageSync('token') }, timeout: 30000,
    success(res) { try { const data = JSON.parse(res.data); if (res.statusCode !== 201) throw new Error(data.error || '上传失败'); resolve({ id: data.id, url: imageUrl(data.url) }); } catch (error) { reject(error); } }, fail() { reject(new Error('图片上传失败，请重试')); }
  }));
}
function imageUrl(url) { return url && url.startsWith('/') ? base + url : url; }
function product(p) { return { ...p, photos: (p.photos || []).map(photo => ({ ...photo, url: imageUrl(photo.url) })), priceLabel: p.price ? String(Number(p.price)) : '', statusLabel: { active: '展示中', pending: '待审核', rejected: '未通过', hidden: '已下架', sold: '已售出' }[p.status] }; }
function ensureLogin() { if (wx.getStorageSync('token')) return true; wx.navigateTo({ url: '/pages/login/login' }); return false; }
function error(error) { wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none', duration: 3000 }); }
module.exports = { request, upload, product, ensureLogin, error, imageUrl };
