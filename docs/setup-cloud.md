# 云开发环境搭建手册

本手册按顺序执行即可从零把「鲜果铺」小程序跑起来。代码本身已完成，这里只处理注册、配置与云端操作。

---

## 1. 小程序注册与资质

1. 在 [微信公众平台](https://mp.weixin.qq.com/) 注册**企业主体**的小程序（个人主体无法开通微信支付，二期真实支付会卡住）。
2. 服务类目选择「电商平台 / 自营电商」或「食品 / 食品销售」，并上传食品经营许可证等资质。资质清单见 [需求文档 11 节](./fruit-shop-miniapp-requirements.md) 的上线前置条件。
3. 记录 AppID，供第 2 节填写。

## 2. 填写 AppID 与云环境 ID

| 位置 | 字段 | 填什么 |
| --- | --- | --- |
| `project.config.json` | `appid` | 小程序 AppID。未拿到前保持 `touristappid`，此时**无法**使用云开发 |
| `miniprogram/utils/config.js` | `ENV_ID` | 云开发环境 ID（形如 `fruit-shop-3g0abc1234`），在开发者工具「云开发」控制台左上角可查 |

云开发环境创建完成后，把环境 ID 填入 `utils/config.js`，否则 `app.js` 里的 `wx.cloud.init` 会报错。

## 3. 部署云函数

部署顺序固定，不可颠倒：

1. `cloudfunctions/common` —— 公共逻辑目录，先上传一次，保证云函数运行时可解析 `../common/lib/*`。
2. `cloudfunctions/initDb` —— 一次性初始化，第 4 节执行完即删除。
3. 其余全部云函数（`createOrder`、`pay`、`cancelOrder`、`confirmReceive`、`closeExpiredOrders`、`adminCheck`、`adminGoods`、`adminOrder`、`verifyPickup`）。

操作：开发者工具左侧资源管理器中右键 `cloudfunctions` 下的函数目录 → **上传并部署：云端安装依赖**。

> 若云端运行时报「Cannot find module '../common/lib/xxx'」，说明该次上传未包含公共目录，把 `cloudfunctions/common/lib` 复制到该云函数目录下再上传。

### 云函数接口登记

| 云函数 | 入参 | 说明 |
| --- | --- | --- |
| `createOrder` | `{ items:[{goodsId,count}], deliveryType, receiver?, pickup?, remark? }` | 校验 + 扣库存 + 服务端算价 + 建单，返回 `{ orderId, orderNo, pickupCode?, payAmount }` |
| `pay` | `{ orderId }` | 一期模拟支付（`config.enableMockPay` 控制），条件更新 `pending_pay → paid` |
| `cancelOrder` | `{ orderId, action? }` | `action='cancel'`（默认）取消待付款订单并回滚库存；`action='hide'` 仅置 `hiddenByUser=true`，不改状态、不回滚库存 |
| `confirmReceive` | `{ orderId }` | 已发货快递单 → 已完成 |
| `adminCheck` | `{}` | 返回 `{ isAdmin, openid }`，「我的」页据此条件渲染商家入口 |
| `adminGoods` | `{ action, payload }` | `action` ∈ `create` / `update` / `toggleStatus` / `setStock` / `remove`，首步鉴权，非管理员返回 `40301`；`setStock` 直接覆盖库存，不参与订单回滚 |
| `adminOrder` | `{ action, payload }` | `action` ∈ `list` / `ship` / `markRefunded`；`list` 入参 `{ tab, page }`（tab: `pending_ship` / `pending_pickup` / `shipped` / `completed` / `all`），每页 10 条；`ship` 入参 `{ id, companyCode, trackingNo }`，companyCode ∈ `SF/JD/ZTO/YTO/YUNDA/EMS/OTHER` |
| `verifyPickup` | `{ orderId?, code }` | 自提码核销，`paid + pickup` → `completed`；连续 3 次错误锁定该商家 5 分钟 |

> 「删除订单」在顾客端复用 `cancelOrder` 的 `action='hide'`，不单独新增云函数。


## 4. 执行初始化

1. 右键 `initDb` → **上传并部署：云端安装依赖**。
2. 打开「云开发控制台 → 云函数 → initDb → 测试」，入参填 `{ "confirm": true }` 并执行。
3. 期望返回 `{ "ok": true, "data": { "created": [...7 个集合], "skipped": [] } }`，控制台「数据库」中可见 `goods`、`orders`、`addresses`、`admins`、`stores`、`config`、`pickupAttempts` 七个集合，`config` 有 4 条文档，`stores` 有 1 条。
4. 再执行一次，期望 `created` 为空、`skipped` 含全部 7 个集合，`config` / `stores` 文档数不变（幂等验证）。
5. **立即删除 `initDb` 云函数**：它没有鉴权，长期在线等于对外开放一次写库入口。

## 5. 集合安全规则

云开发控制台 → 数据库 → 选中集合 → 权限设置 → **自定义安全规则**，逐个填写：

```json
// goods —— 所有人可读，仅云函数（管理员）可写
{ "read": true, "write": false }
```

```json
// orders —— 仅下单人可读，写操作全部走云函数
{ "read": "doc._openid == auth.openid", "write": false }
```

```json
// addresses —— 仅本人可读写
{ "read": "doc._openid == auth.openid", "write": "doc._openid == auth.openid" }
```

```json
// stores —— 门店名/地址/电话/营业时间属公开信息，顾客端下单页需要展示，写仅云函数
{ "read": true, "write": false }
```

```json
// admins / config / pickupAttempts —— 客户端完全不可访问
{ "read": false, "write": false }
```

云函数写库时不受上述规则限制，但必须在文档中显式写入 `_openid`（云函数不会自动注入），否则「仅创建者可读」规则会让顾客读不到自己的订单。

验证：用非管理员身份在开发者工具 Console 执行 `wx.cloud.database().collection('admins').get()`，应报权限错误。

## 6. 索引与定时触发器

### 索引

数据库 → 选中集合 → 索引管理 → 新建索引：

| 集合 | 字段 | 类型 | 说明 |
| --- | --- | --- | --- |
| `goods` | `status`(升序) + `sort`(升序) | 普通 | 商品列表排序 |
| `goods` | `category`(升序) + `status`(升序) | 普通 | 分类筛选 |
| `orders` | `orderNo`(升序) | **唯一** | 防重复订单号 |
| `orders` | `openid`(升序) + `createdAt`(降序) | 普通 | 顾客订单列表 |
| `orders` | `status`(升序) + `createdAt`(升序) | 普通 | 超时关单扫描、商家订单列表 |
| `addresses` | `openid`(升序) | 普通 | 地址列表 |

### 定时触发器

`cloudfunctions/closeExpiredOrders/config.json`（与 `index.js` 同级）：

```json
{
  "triggers": [
    {
      "name": "closeExpired",
      "type": "timer",
      "config": "0 * * * * * *"
    }
  ]
}
```

`config` 为 7 段 Cron（秒 分 时 日 月 周 年），`0 * * * * * *` 表示每分钟第 0 秒执行一次。配置后右键 `closeExpiredOrders` → **上传触发器**。

### 管理员白名单

上线前在 `admins` 集合手工插入商家记录：

```json
{ "_id": "admin_xxx", "openid": "商家的 openid" }
```

商家 openid 可在「我的」页面通过 `adminCheck` 云函数返回结果或云开发日志中获取。

### 自提核销锁定记录（`pickupAttempts`）

`verifyPickup` 按商家 openid 记录失败次数，集合保持客户端不可访问：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 商家 openid（每人一条） |
| `fails` | number | 当前连续错误次数，0–3 |
| `lockedUntil` | number | 锁定截止时间戳（毫秒），0 表示未锁定 |
| `createdAt` / `updatedAt` | date | 记录创建与更新时间 |

连续第 3 次错误时写入 `lockedUntil = 当前时间 + 5 分钟` 并把 `fails` 清零；锁定期间任何自提码都会被拒绝；核销成功后 `fails` 与 `lockedUntil` 一并清零。
