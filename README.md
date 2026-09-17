# 盒闲 · 校园闲置

单校闲置信息发布平台，免费发布、人工审核、分类搜索、收藏与线下联系。当前 UI 根据 `盒闲-手机版UI (3).html` 接入浏览器业务前台，并同步微信原生小程序。无在线订单、付款、佣金或付费置顶。

## 本机运行

需要 Node.js 24。

```powershell
npm ci
npm run dev
```

前台：http://127.0.0.1:3000；审核后台：http://127.0.0.1:3000/admin.html。
本机演示管理员密码 `demo-admin-2026`。前台可选小林/小陈演示身份，接口、图片与数据库是真实实现，demo 只监听本机，禁止公网部署。

流程：中央“闲置”登录发布 → 在“我的 / 我发布的”查看待审核 → 后台通过 → 首页和顶部搜索可见 → 收藏、登录查看联系方式 → 线下成交后标记已售。

## 新 UI 与功能边界

- 盒闲品牌、绿色视觉、顶部展开式即时搜索、5 秒轮播、双列商品卡片、价格数字统一。
- 底部：首页 / 失物 / 圆形闲置发布 / 消息 / 我的；上传框内最多六张照片，追加、删除与末尾加号。
- “我的”含我想要的、我发布的、我的收藏；真实数据通过 API 保存，刷新保留。
- 失物和消息保留页面入口，明确提示尚未开放。站内聊天和交易反馈后台没有实现；联系卖家仍使用真实联系方式接口。
- 发布、编辑必须审核通过才公开；静态原型的即时公开行为不用于业务版。
- 微信开发者工具编译、真机、真实微信登录和提审尚未验收。

## 静态预览与部署区别

`web/demo.html` 是可双击打开的独立 UI 原型，与 `docs/prototypes/heji-mobile.html` 同步，数据仅本页演示、刷新清空；它不连接 API，不适合真实用户交易。Express 业务入口请用 `/`；独立 HTML 应离线打开或用静态服务器查看，其内联脚本不适用于业务服务的严格 CSP。

此前的 GitHub Pages 演示地址不代表本次已部署。GitHub 仓库 push 只上传源文件；Pages 不能运行 Express/SQLite。真实服务需部署后端、持久化数据与 HTTPS。旧 README 所述 localStorage 单文件模拟后台已由本次独立 UI 预览替换。

## 文档与目录

- [技术栈与架构](docs/technical-design.md)：版本、页面映射、数据结构、文件职责。
- [API 接口](docs/api.md)：参数、鉴权、响应、校验及状态规则。
- [产品设计](docs/product-design.md)、[部署说明](docs/deployment.md)、[验证记录](docs/validation.md)。
- `web/`：浏览器前台、后台和样式；`miniprogram/`：原生微信客户端；`server/`：Express/SQLite；`tests/`：自动化测试。

## 验证与微信导入

```powershell
npm run check
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

E2E 使用独立 3107 端口及 data/e2e 数据库。导入 `miniprogram` 到微信开发者工具，替换 touristappid；修改 config.js 的 API_BASE 为实际后端 HTTPS 地址。AppSecret 只放服务端环境变量。生产关闭演示登录；使用 `.env.example` 配置，按部署文档完成域名、微信及云端验证。
