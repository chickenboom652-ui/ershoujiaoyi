# 盒闲 REST API

更新日期：2026-09-17。以 server/app.js / server/store.js 为实现依据。本次 UI 迁移沿用这些接口，不新增聊天、失物或反馈接口。

## 约定

- 基地址 /api；浏览器同源，小程序 API_BASE 不包含 /api 后缀。
- 除图片上传/响应外使用 JSON，写请求 Content-Type: application/json。
- 登录返回 {token,user}，后续请求 Authorization: Bearer <token>。管理员与用户权限互不替代。
- 错误体 {"error":"说明"}。常见状态码：400 参数错误、401 未登录、403 权限错误、404 不存在/不可见、409 状态冲突、429 限流、500 内部错误。
- API 默认不缓存；同源浏览器写请求检查 Origin。一般每分钟 180 次请求，登录接口每 15 分钟 20 次；上传另外限制每小时40次；测试可关闭限流。
- 时间为 Unix 毫秒。商品价格为两位小数字符串，数据库按整数分存储。

## 配置与认证

| 方法与路径 | 权限 | 请求 / 响应 |
| --- | --- | --- |
| GET /config | 公开 | schoolName、categories、demo、maxPhotos:6 |
| GET /health | 公开 | {ok:true}，同时执行数据库查询 |
| POST /auth/demo | 仅本机 demo | {account:"seller"或"buyer"} → {token,user:{id,name}} |
| POST /auth/wechat | 公开 | {code}，来自 wx.login → {token,user:{id,name}} |
| POST /auth/admin | 公开 | {password} → {token} |
| POST /auth/logout | 可选会话 | 撤销当前令牌 → {ok:true} |
| GET /me | 用户 | {id,name} |

## 图片与商品

| 方法与路径 | 权限 | 说明 |
| --- | --- | --- |
| POST /uploads | 用户 | multipart/form-data，photo 文件字段；201 → {id,url}。JPEG/PNG/WebP，经压缩后保存 |
| GET /media/:id | 按可见性 | WebP；非公开图片可通过 expires、signature 签名参数访问 |
| GET /products | 公开 | q（0–80 字）、category（配置中的值）、page（默认1）；返回 {items,total,page,hasMore}，每页20条 |
| GET /products/:id | 公开/所有者/管理员 | active 公开；其他状态仅所有者/管理员可见，详情包含 description |
| GET /products/:id/contact | 用户 | active 商品才可联系；返回 {contact_type,contact_value,location,delivery} |
| GET /mine | 用户 | {items}，本人所有状态商品，按更新时间降序 |
| GET /favorites | 用户 | {items}，按收藏时间降序；不可见商品返回 unavailable:true 和有限摘要 |
| POST /products | 用户 | 完整商品请求体；201 返回商品详情，初始 pending |
| PUT /products/:id | 所有者 | 完整商品请求体；更新后 pending，重新审核 |
| PATCH /products/:id/status | 所有者 | {status:"sold"或"hidden"或"pending"} → {ok:true} |
| PUT /products/:id/favorite | 用户 | 收藏在售商品，幂等 → {ok:true} |
| DELETE /products/:id/favorite | 用户 | 取消本人收藏，幂等 → {ok:true} |
| POST /products/:id/report | 用户 | {reason}，2–300字；201 → {ok:true}，未处理重复举报返回409 |

查询同时匹配名称和简介；服务端对 LIKE 通配符进行转义，按 created_at DESC、id 排序。浏览器即时建议使用第1页前8条，提交搜索显示分页列表。小程序即时查询复用列表请求并丢弃过期响应。

完整商品请求体示例：

```json
{
  "title": "暖光阅读台灯",
  "description": "附电源线，灯光正常，底座有轻微痕迹。",
  "category": "宿舍好物",
  "quantity": 1,
  "price": "35.00",
  "delivery": "pickup",
  "location": "图书馆门口",
  "contact_type": "wechat",
  "contact_value": "seller_example",
  "contact_consent": true,
  "photo_ids": ["由上传接口返回的图片ID"]
}
```

约束：title 2–40字；description 1–1000字；quantity 整数1–999；price 0.01–999999元、最多2位小数；delivery 为 pickup/delivery；location 最长120字，自取必填；contact_type 为 wechat/phone；contact_value 3–50字，手机号须符合大陆11位格式；contact_consent 必须 true；photo_ids 为1–6个不重复且属于本人的图片ID。分类以 /config 返回值为准。

商品通用响应字段：id、title、category、quantity、price、delivery、status、created_at、updated_at、is_owner、is_favorite、photos:[{id,url}]、seller_name、can_contact。详情增加 description；所有者和管理员额外可见 location、contact_type、contact_value、review_note。联系方式不在公开详情中泄露。

## 管理接口

| 方法与路径 | 权限 | 说明 |
| --- | --- | --- |
| GET /admin/products | 管理员 | {items}，最近更新的最多200条 |
| POST /admin/products/:id/review | 管理员 | {status:"active"或"rejected"或"hidden",note}；通过只允许 pending，驳回/下架说明2–300字；返回 {ok:true} |
| GET /admin/reports | 管理员 | {items}，未处理优先，最多200条 |
| PATCH /admin/reports/:id | 管理员 | 标记举报已处理 → {ok:true} |

状态含义：pending 待审核、active 在售、rejected 驳回、hidden 下架、sold 已售。卖家无法自行变成 active；只有 active 能标记 sold。所有内容编辑重新进入 pending。卖家下架/已售后，不再出现在公共搜索，联系方式接口返回409；其他用户查看详情返回404。

## 不存在的接口

无 /orders、/payments、/messages、/lost、/feedback；静态原型中的聊天和反馈只供 UI 演示。生产消息页显示尚未开放，不发送虚构回复。未来开发这些能力必须另行确定权限、数据模型与验收范围。
