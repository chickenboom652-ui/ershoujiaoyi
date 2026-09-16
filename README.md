# 青集 · 校园闲置

单校校园闲置信息发布平台：免费发布、分类搜索、收藏，双方自行联系线下交易。价格直接展示卖家填写的单价，无 5% 加价、无支付、无佣金。

## 已实现
- 原生微信小程序：首页、发布/编辑、详情、我的发布、我的收藏、登录、使用须知。
- 商品多图上传、名称、简介、分类、数量、价格、自取/送达；自取地点必填。
- 微信服务端登录、本机双账号演示登录、会话管理与所有权校验。
- 管理员审核、驳回、下架、举报处理，修改商品后重新审核。
- 真实 SQLite 持久化、图片验证压缩、隐藏非公开商品/联系方式。
- 响应式浏览器预览与管理员后台，复用同一 API。

## 本机启动（Node.js 24）
```powershell
npm.cmd ci
npm.cmd run dev
```
打开 http://127.0.0.1:3000 。前台登录可选“小林同学/小陈同学”，方便两角色体验。

管理员地址：http://127.0.0.1:3000/admin.html

**仅本机演示密码：`demo-admin-2026`**。正式环境必须单独配置密码，禁止部署演示模式到公网。初始商品均为虚构演示数据，演示库与正式库分离。

体验：小林登录→发布商品→管理员通过→小陈搜索、收藏、查看联系方式→小林标记已售。照片至少 1 张，简介与自取地点必填。

## 微信开发者工具
导入 `miniprogram` 文件夹，替换 `project.config.json` 的 touristappid 为真实 AppID。`config.js` 默认指向本机，开发工具可按开发需要关闭本地合法域名校验；真机与正式上线必须使用已配置的 HTTPS 服务。微信登录需服务器配置真实 AppID/AppSecret。目前没有执行微信真机验收，不能把浏览器测试当成微信审核通过。

## 项目目录
```
server/        Express API、SQLite、演示种子
web/           浏览器前台、管理员后台
miniprogram/   原生微信小程序
tests/         API 和小程序逻辑测试、浏览器端到端测试
scripts/       验证与备份工具
deploy/        Nginx 模板
docs/          产品设计和部署说明
```

## 验证
```powershell
npm.cmd run check
# 安装 Playwright Chromium，或使用本机 Edge：
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:e2e
```
不指定 channel 时需先执行 `npx playwright install chromium`。端到端测试自动启动独立 3107 端口与 data/e2e 数据库，不修改日常演示库。

## 部署
见 [部署说明](docs/deployment.md) 和 [产品设计](docs/product-design.md)。提供 Docker Compose、Nginx 模板与备份脚本；未代购服务器、未部署公网、未提交微信审核。正式运行前核实主体类目、完成备案，补齐真实隐私说明和人工审核流程。

当前媒体使用本地持久化磁盘，尚未接入 OSS；没有自动学生身份核验。学校名称可在环境变量 SCHOOL_NAME 中设置。
