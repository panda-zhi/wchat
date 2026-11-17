# 水果销售微信小程序 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`（推荐）或 `executing-plans` 按任务逐条实施本计划。步骤使用 `- [ ]` 复选框跟踪进度。

**Goal:** 交付一个单商家水果销售微信小程序：商家可上下架商品与改库存，顾客可下单并用模拟支付完成交易，支持快递与自提两种履约，快递订单展示运单号。

**Architecture:** 微信小程序原生前端 + 微信云开发（云函数 / 云数据库 / 云存储）。所有写操作与金额计算收敛在云函数；前端只读商品与自己可见的订单数据。库存采用下单即扣 + 原子条件更新防超卖，15 分钟未支付由定时云函数关单回滚。支付实现按配置分支，一期模拟支付、二期替换为云开发微信支付而不改页面。

**Tech Stack:** 微信小程序原生（WXML/WXSS/JS）、微信云开发（Node.js 18 运行时，CommonJS）、wx-server-sdk、Node 内置 `node:test` + `node:assert` 做云函数纯逻辑单测。

**Spec:** [docs/fruit-shop-miniapp-requirements.md](../fruit-shop-miniapp-requirements.md)

## Global Constraints

- **版本控制仅用 SVN，禁止任何 git 命令。** 提交使用 `svn add` + `svn commit -m "..."`。当前 `h:\wchat` 不是 SVN 工作副本，Task 1 第 1 步先确认/建立工作副本。
- 金额一律用**整数分**存储与传输，展示时才除以 100。运费：商品金额 ≥ `5900` 分免运费，否则 `800` 分；自提订单运费恒为 `0`。
- 订单未支付超时 `15` 分钟自动关闭；自提码为 `4` 位数字；商品列表每页 `10` 条；小程序基础库 ≥ `2.21.2`。
- 云函数统一返回 `{ ok: boolean, data?: any, code?: number, message?: string }`，失败不抛异常给前端。
- 错误码固定：`40001` 商品不存在或已下架、`40002` 库存不足、`40003` 订单状态不允许、`40004` 参数错误、`40010` 支付未开通、`40301` 无权限、`40303` 当前状态不可取消。
- 云函数写数据库时必须同时写入 `_openid`（云函数不会自动注入），供"仅创建者可读"安全规则生效。
- 前端不传价格参与计算；云函数忽略请求中的任何金额字段。
- 云函数目录 `cloudfunctions/<name>/`，公共逻辑放 `cloudfunctions/common/lib/`，单测放 `cloudfunctions/common/tests/`；`common/lib` 内的模块**不得 require `wx-server-sdk`**（保证可在本地 Node 直接测试）。
- 除 `wx-server-sdk` 外不引入第三方运行时依赖（不引入 jest、lodash、dayjs）。
- 所有页面文案为中文；页面路径与需求文档 7.2 节一致。

## Review Focus

以下五类问题最可能在真实使用中出故障，每一条都在对应任务的测试里钉住：

1. **库存 1 件被两个用户同时下单** —— 期望只有 1 单成功，另一单明确提示库存不足，`stock` 永不为负。（Task 7 的 `deductOne` 条件更新测试 + Task 14 双账号实测）
2. **多商品订单中途失败** —— 期望整单失败，已扣成功的商品库存全部回滚，不出现"扣了库存却没订单"。（Task 7 的 `deductAll` 回滚测试）
3. **重复提交 / 重复支付** —— 期望订单状态只变更一次，不产生重复扣款或重复改单。（Task 8 的 `assertPayable` + 条件更新测试）
4. **商品在下单前被下架或库存被商家改为 0** —— 期望下单校验拦截，购物车标失效，不出现负库存订单。（Task 4 详情页校验、Task 5 `pruneInvalid`、Task 7 `off_sale` 测试）
5. **非白名单用户直接调用管理云函数** —— 期望所有 `admin*` / `verifyPickup` 云函数首行鉴权即返回 `40301`，前端隐藏入口不作为安全边界。（Task 11 `isAdmin` 测试 + Task 12/13 云函数首步鉴权）

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `project.config.json` | 小程序项目配置（appid、miniprogramRoot、cloudfunctionRoot） |
| `miniprogram/app.js` / `app.json` / `app.wxss` | 应用入口、页面注册、全局样式变量 |
| `miniprogram/utils/config.js` | 云环境 ID 等常量 |
| `miniprogram/utils/request.js` | `wx.cloud.callFunction` 封装，统一返回解包与错误提示 |
| `miniprogram/utils/format.js` | 金额/时间展示格式化 |
| `miniprogram/utils/cart.js` | 购物车纯逻辑（Storage 读写 + 增删改算） |
| `miniprogram/utils/goods.js` | 商品库存状态展示逻辑 |
| `miniprogram/utils/address.js` | 地址表单校验 |
| `miniprogram/components/*` | `goods-card`、`empty`、`price`、`status-tag` |
| `miniprogram/pages/index/` | 商品列表（分类 Tab + 分页） |
| `miniprogram/pages/goods/detail/` | 商品详情 |
| `miniprogram/pages/cart/` | 购物车 |
| `miniprogram/pages/order/confirm/` | 确认订单（快递/自提切换） |
| `miniprogram/pages/order/list/` | 订单列表（状态 Tab） |
| `miniprogram/pages/order/detail/` | 订单详情（时间轴、运单号、自提码） |
| `miniprogram/pages/address/list/`、`edit/` | 地址管理 |
| `miniprogram/pages/mine/` | 我的（订单入口、商家入口条件渲染） |
| `miniprogram/pages/admin/goods/list/`、`edit/` | 商家商品管理 |
| `miniprogram/pages/admin/order/list/`、`ship/`、`verify/` | 商家订单管理、发货、核销 |
| `cloudfunctions/common/lib/money.js` | 分/元转换、运费与实付计算 |
| `cloudfunctions/common/lib/orderNo.js` | 订单号生成 |
| `cloudfunctions/common/lib/pickupCode.js` | 自提码生成与格式校验 |
| `cloudfunctions/common/lib/status.js` | 订单状态常量与流转校验 |
| `cloudfunctions/common/lib/errors.js` | 统一错误码与 `fail()/ok()` 响应构造 |
| `cloudfunctions/common/lib/stock.js` | 库存原子扣减、批量扣减与回滚（db 参数注入） |
| `cloudfunctions/common/lib/auth.js` | 管理员鉴权（db 参数注入） |
| `cloudfunctions/common/lib/orderRules.js` | 取消/确认收货/发货/核销的业务规则（纯函数） |
| `cloudfunctions/common/lib/goodsRules.js` | 商品字段校验（纯函数） |
| `cloudfunctions/common/lib/payRules.js` | 支付前置校验（纯函数） |
| `cloudfunctions/createOrder/` | 建单：校验、扣库存、算价、生成自提码 |
| `cloudfunctions/pay/` | 模拟支付 / 微信支付下单分支 |
| `cloudfunctions/cancelOrder/`、`confirmReceive/` | 取消（回滚库存）、确认收货 |
| `cloudfunctions/closeExpiredOrders/` | 定时关闭超时未支付订单 |
| `cloudfunctions/adminCheck/` | 返回当前 openid 是否管理员 |
| `cloudfunctions/adminGoods/` | 商品增改、上下架、改库存、删除 |
| `cloudfunctions/adminOrder/` | 商家订单列表、发货、标记退款 |
| `cloudfunctions/verifyPickup/` | 自提码核销 |
| `cloudfunctions/initDb/` | 初始化集合、门店与配置（幂等） |
| `docs/setup-cloud.md` | 云环境初始化手册：集合权限安全规则、索引、触发器、部署顺序 |

---

### Task 1: 项目骨架与云开发初始化

**Files:**
- Create: `project.config.json`、`miniprogram/app.js`、`miniprogram/app.json`、`miniprogram/app.wxss`、`miniprogram/utils/config.js`、`miniprogram/utils/request.js`、`miniprogram/pages/index/index.{js,json,wxml,wxss}`、`miniprogram/pages/mine/mine.{js,json,wxml,wxss}`

**Interfaces:**
- Produces:
  - `utils/request.js`：`callFn(name: string, data?: object, opts?: { loading?: boolean }) -> Promise<any>`；成功返回 `res.result.data`，`ok === false` 时 `wx.showToast` 展示 `message` 并 reject 一个带 `code` 的 Error。
  - `utils/config.js`：`module.exports = { ENV_ID: '<待填>', PAGE_SIZE: 10 }`
  - `app.json` 的 `pages` 数组为后续任务追加页面的唯一注册点。

- [ ] **Step 1: 确认 SVN 工作副本**

运行：`svn info h:\wchat`
Expected: 输出 `Working Copy Root Path: h:\wchat`。若报 `is not a working copy`，暂停并询问用户仓库地址后执行 `svn checkout <url> h:\wchat`（不要自行创建仓库）。

- [ ] **Step 2: 建立目录与项目配置**

`project.config.json` 关键字段：`appid` 填用户提供的小程序 AppID（未知则留 `touristappid` 并在 `docs/setup-cloud.md` 标注待替换）、`miniprogramRoot: "miniprogram/"`、`cloudfunctionRoot: "cloudfunctions/"`、`compileType: "miniprogram"`。

`app.json`：`pages: ["pages/index/index", "pages/mine/mine"]`，`window.navigationBarTitleText: "鲜果铺"`，`window.navigationBarBackgroundColor: "#FF7A45"`，`window.navigationBarTextStyle: "white"`。

`app.wxss`：定义 CSS 变量 `--color-primary: #FF7A45; --color-price: #FF3B30; --color-text: #333; --color-muted: #999; --color-bg: #F7F7F7;` 与基础 `page { background: var(--color-bg); font-size: 28rpx; }`。

- [ ] **Step 3: 初始化云开发**

`app.js`：

```js
const { ENV_ID } = require('./utils/config')
App({
  onLaunch() {
    wx.cloud.init({ env: ENV_ID, traceUser: true })
  }
})
```

- [ ] **Step 4: 封装云函数调用**

`utils/request.js` 实现 `callFn`：默认 `wx.showLoading({ title: '加载中', mask: true })`，`wx.cloud.callFunction({ name, data })`，`finally` 中 `wx.hideLoading()`；`res.result` 不存在时 reject `{ code: -1, message: '服务异常' }`；`ok === false` 时 toast `message` 并 reject。

- [ ] **Step 5: 验证编译**

用微信开发者工具导入 `h:\wchat`，编译。
Expected: 首页与"我的"页可打开，Console 无 `cloud.init` 报错，Network 无 404。

- [ ] **Step 6: 提交**

```bash
svn add project.config.json miniprogram docs --force
svn commit -m "chore: 初始化小程序骨架与云开发调用封装"
```

> 本任务为配置与 SDK 封装，无可本地执行的业务逻辑，故不写单测；从 Task 2 起凡有纯逻辑必须带测试。

---

### Task 2: 公共纯函数库（金额 / 订单号 / 自提码 / 状态机）

**Files:**
- Create: `cloudfunctions/common/package.json`、`cloudfunctions/common/lib/money.js`、`orderNo.js`、`pickupCode.js`、`status.js`、`errors.js`
- Test: `cloudfunctions/common/tests/money.test.js`、`orderNo.test.js`、`pickupCode.test.js`、`status.test.js`

**Interfaces:**
- Produces:
  - `money.yuanToFen(v: string|number) -> number`（四舍五入到整数分）
  - `money.fenToYuan(fen: number) -> string`（固定两位小数，如 `'59.90'`）
  - `money.calcFreight(goodsAmount: number, deliveryType: 'express'|'pickup', cfg: { freeThreshold: number, fee: number }) -> number`
  - `money.calcPayAmount(goodsAmount, deliveryType, cfg) -> { goodsAmount, freightAmount, payAmount }`
  - `orderNo.genOrderNo(now?: Date) -> string`（`yyyyMMdd` + 6 位随机数字）
  - `pickupCode.genPickupCode() -> string`（`1000`–`9999`，避免前导零歧义）；`pickupCode.isValidPickupCode(s) -> boolean`（`/^\d{4}$/`）
  - `status.ORDER_STATUS = { PENDING_PAY:'pending_pay', PAID:'paid', SHIPPED:'shipped', COMPLETED:'completed', CANCELLED:'cancelled', REFUNDING:'refunding', REFUNDED:'refunded' }`
  - `status.canTransit(from: string, to: string) -> boolean`
  - `errors.ok(data)`、`errors.fail(code, message)`、`errors.CODES`

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/money.test.js
const test = require('node:test')
const assert = require('node:assert')
const money = require('../lib/money')

test('yuanToFen 处理小数与字符串', () => {
  assert.strictEqual(money.yuanToFen('59.9'), 5990)
  assert.strictEqual(money.yuanToFen(0.1 + 0.2), 30)
})
test('fenToYuan 固定两位小数', () => {
  assert.strictEqual(money.fenToYuan(5990), '59.90')
  assert.strictEqual(money.fenToYuan(0), '0.00')
})
test('运费：满5900免运费，否则800，自提恒0', () => {
  const cfg = { freeThreshold: 5900, fee: 800 }
  assert.strictEqual(money.calcFreight(5800, 'express', cfg), 800)
  assert.strictEqual(money.calcFreight(5900, 'express', cfg), 0)
  assert.strictEqual(money.calcFreight(100, 'pickup', cfg), 0)
})
test('calcPayAmount 金额合计正确', () => {
  const r = money.calcPayAmount(5800, 'express', { freeThreshold: 5900, fee: 800 })
  assert.deepStrictEqual(r, { goodsAmount: 5800, freightAmount: 800, payAmount: 6600 })
})
```

```js
// cloudfunctions/common/tests/status.test.js
const { ORDER_STATUS, canTransit } = require('../lib/status')
test('允许的状态流转', () => {
  assert.strictEqual(canTransit(ORDER_STATUS.PENDING_PAY, ORDER_STATUS.PAID), true)
  assert.strictEqual(canTransit(ORDER_STATUS.PAID, ORDER_STATUS.SHIPPED), true)
  assert.strictEqual(canTransit(ORDER_STATUS.SHIPPED, ORDER_STATUS.COMPLETED), true)
  assert.strictEqual(canTransit(ORDER_STATUS.PENDING_PAY, ORDER_STATUS.CANCELLED), true)
})
test('禁止跳过或倒退的状态流转', () => {
  assert.strictEqual(canTransit(ORDER_STATUS.PENDING_PAY, ORDER_STATUS.SHIPPED), false)
  assert.strictEqual(canTransit(ORDER_STATUS.COMPLETED, ORDER_STATUS.PAID), false)
  assert.strictEqual(canTransit(ORDER_STATUS.CANCELLED, ORDER_STATUS.PAID), false)
})
```

`orderNo.test.js` 断言 `genOrderNo(new Date('2026-11-17T10:00:00+08:00'))` 匹配 `/^20261117\d{6}$/`；`pickupCode.test.js` 断言生成值匹配 `/^[1-9]\d{3}$/`，且 `isValidPickupCode('0123') === false`。

- [ ] **Step 2: 运行测试确认失败**

运行：`node --test cloudfunctions/common/tests/`
Expected: FAIL，报 `Cannot find module '../lib/money'`。

- [ ] **Step 3: 实现五个模块**

`money.yuanToFen` 用 `Math.round(Number(v) * 100)`；`fenToYuan` 用 `(fen / 100).toFixed(2)`；`calcFreight` 判断 `deliveryType === 'pickup'` 直接返回 0，再比较免运费阈值；`genOrderNo` 用本地日期拼 `yyyyMMdd` + `Math.floor(100000 + Math.random() * 900000)`；`status.canTransit` 用允许流转表 `{ pending_pay:['paid','cancelled'], paid:['shipped','completed','refunding'], shipped:['completed'], refunding:['refunded'] }`；`errors.CODES` 按 Global Constraints 定义。

`cloudfunctions/common/package.json`：`{"name":"common","version":"1.0.0","main":"lib/index.js"}`，不声明依赖。

- [ ] **Step 4: 运行测试确认通过**

运行：`node --test cloudfunctions/common/tests/`
Expected: PASS，全部用例通过，0 failed。

- [ ] **Step 5: 提交**

```bash
svn add cloudfunctions/common
svn commit -m "feat: 增加金额、订单号、自提码与订单状态机公共库"
```

---

### Task 3: 数据库初始化（集合 / 门店 / 配置 / 权限与索引手册）

**Files:**
- Create: `cloudfunctions/initDb/index.js`、`cloudfunctions/initDb/package.json`、`docs/setup-cloud.md`
- Modify: `docs/fruit-shop-miniapp-requirements.md`（仅在集合有增减时同步，否则不动）

**Interfaces:**
- Consumes: `common/lib/errors.js`
- Produces: 集合 `goods / orders / addresses / admins / stores / config / pickupAttempts`；`config` 文档键：`freightFreeThreshold=5900`、`freightFee=800`、`enableMockPay=false`、`orderTimeoutMinutes=15`；`stores` 一条默认门店。

- [ ] **Step 1: 实现幂等初始化云函数**

`initDb/index.js`：对每个集合 `db.createCollection(name)`，捕获 `-501001`（已存在）视为跳过；对 `config` 的每个键 `where({key}).count()` 为 0 才 `add`；`stores` 为空时插入默认门店 `{ name:'鲜果铺（示例店）', address:'请填写门店地址', phone:'请填写', businessHours:'09:00-21:00', isActive:true }`。返回 `{ ok:true, data:{ created:[], skipped:[] } }`。

- [ ] **Step 2: 编写云环境手册**

`docs/setup-cloud.md` 写清 6 件事：
1. 小程序注册与企业认证、食品类目资质清单（引用需求文档 11 节）。
2. `project.config.json` 中 `appid` 与 `utils/config.js` 中 `ENV_ID` 的填写位置。
3. 部署顺序：`common` → `initDb` → 其余云函数；`cloudfunctionRoot` 右键"上传并部署：云端安装依赖"。
4. **集合安全规则**（云开发控制台 → 数据库 → 权限设置 → 自定义安全规则）：

```json
// goods
{ "read": true, "write": false }
// orders
{ "read": "doc._openid == auth.openid", "write": false }
// addresses
{ "read": "doc._openid == auth.openid", "write": "doc._openid == auth.openid" }
// admins / stores / config / pickupAttempts
{ "read": false, "write": false }
```

5. **索引**：`goods(status, sort)`、`goods(category, status)`；`orders(orderNo)` 唯一、`orders(openid, createdAt)` 降序、`orders(status, createdAt)`；`addresses(openid)`。
6. **定时触发器**：`closeExpiredOrders` 配置 `{"triggers":[{"name":"closeExpired","type":"timer","config":"0 * * * * * *"}]}`（每分钟）。

- [ ] **Step 3: 部署并执行**

开发者工具右键 `initDb` → 上传并部署 → 云开发控制台"云函数 → 测试"执行 `{ "confirm": true }`。
Expected: 返回 `ok:true`；控制台可见 7 个集合，`config` 有 4 条文档，`stores` 有 1 条。
执行成功后**立即在云开发控制台删除 `initDb` 云函数**：它是不可鉴权的一次性初始化脚本，不允许长期在线。

- [ ] **Step 4: 验证幂等与权限**

再次执行 `initDb`，Expected: `created` 为空、`skipped` 含全部集合，`config`/`stores` 文档数不变。
用非管理员身份在开发者工具 Console 执行 `wx.cloud.database().collection('admins').get()`，Expected: 报权限错误（证明客户端不可读）。

- [ ] **Step 5: 提交**

```bash
svn add cloudfunctions/initDb docs/setup-cloud.md
svn commit -m "feat: 增加数据库初始化云函数与云环境配置手册"
```

---

### Task 4: 商品列表与商品详情

**Files:**
- Create: `miniprogram/utils/goods.js`、`miniprogram/components/goods-card/*`、`miniprogram/components/empty/*`、`miniprogram/pages/index/index.{js,json,wxml,wxss}`、`miniprogram/pages/goods/detail/*`
- Test: `cloudfunctions/common/tests/goodsDisplay.test.js`
- Modify: `miniprogram/app.json`（注册 `pages/goods/detail/detail`）

**Interfaces:**
- Produces: `utils/goods.js` 的 `decorateStock(goods) -> { soldOut: boolean, stockText: string, buyable: boolean }`
  - `stock === 0` → `{ soldOut: true, stockText: '已售罄', buyable: false }`
  - `0 < stock <= 5` → `{ soldOut: false, stockText: '仅剩N件', buyable: true }`
  - `stock > 5` → `{ soldOut: false, stockText: '有货', buyable: true }`
  - 商品 `status !== 'on_sale'` → `{ soldOut: true, stockText: '已下架', buyable: false }`

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/goodsDisplay.test.js
const test = require('node:test')
const assert = require('node:assert')
const { decorateStock } = require('../../../miniprogram/utils/goods')

test('库存为0显示已售罄且不可购买', () => {
  assert.deepStrictEqual(decorateStock({ stock: 0, status: 'on_sale' }),
    { soldOut: true, stockText: '已售罄', buyable: false })
})
test('库存1-5显示仅剩N件', () => {
  assert.strictEqual(decorateStock({ stock: 3, status: 'on_sale' }).stockText, '仅剩3件')
})
test('下架商品不可购买', () => {
  assert.strictEqual(decorateStock({ stock: 99, status: 'off_sale' }).buyable, false)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/goodsDisplay.test.js`
Expected: FAIL，`Cannot find module` 或 `decorateStock is not a function`。

- [ ] **Step 3: 实现 `utils/goods.js` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/goodsDisplay.test.js`
Expected: PASS 3 个用例。

- [ ] **Step 4: 实现商品列表页**

`onLoad` 查 `goods` 集合：`where({ status:'on_sale', ...(category ? { category } : {}) }).orderBy('sort','asc').orderBy('createdAt','desc').skip(page*10).limit(10)`。顶部 5 个分类 Tab（全部/时令/进口/果切/礼盒，值为空/`seasonal`/`imported`/`cut`/`gift`）。`onReachBottom` 加载下一页，无更多时显示"没有更多了"。下拉刷新重置分页。卡片复用 `goods-card` 组件，展示封面、名称、`fenToYuan(price)`、单位、`stockText`，售罄加半透明蒙层。

- [ ] **Step 5: 实现商品详情页**

`onLoad({ id })` 查单条；`status !== 'on_sale'` 时显示"商品已下架"并禁用按钮。底部操作栏：购物车图标、加入购物车、立即购买；未上架/售罄时按钮置灰。图片用 `swiper` 展示 `images`，无图时用 `coverUrl` 兜底。加购与立即购买按钮先调用 `cart.addItem` 并跳转（购物车逻辑在 Task 5，本步先用 `wx.navigateTo` 到购物车占位并 `wx.setStorageSync` 暂存）。

- [ ] **Step 6: 手工验证**

开发者工具造 3 条 `goods` 数据（有货、仅剩 3 件、库存 0），Expected：列表顺序按 `sort`、售罄蒙层正确、下架商品不出现在列表、详情页库存文案与按钮状态一致。

- [ ] **Step 7: 提交**

```bash
svn add miniprogram/utils/goods.js miniprogram/components miniprogram/pages/goods
svn commit -m "feat: 商品列表与详情页，含售罄与下架态"
```

---

### Task 5: 购物车

**Files:**
- Create: `miniprogram/utils/cart.js`、`miniprogram/pages/cart/cart.{js,json,wxml,wxss}`
- Test: `cloudfunctions/common/tests/cart.test.js`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Produces（全部为纯函数，不直接读写 Storage）：
  - `addItem(cart, goods, count) -> { cart, added: boolean, message?: string }`（同商品累加；单商品 ≤ 99；条目 ≤ 50）
  - `updateCount(cart, goodsId, count) -> cart`（clamp 到 1–99）
  - `removeItem(cart, goodsId) -> cart`
  - `toggleItem(cart, goodsId, checked) -> cart`、`toggleAll(cart, checked) -> cart`
  - `sumAmount(cart) -> { totalFen: number, count: number }`（只统计 `checked === true` 的条目）
  - `pruneInvalid(cart, goodsList) -> { cart, invalid: string[] }`（下架或库存 < 数量的条目标记 `invalid: true` 并取消勾选）
  - `load() / save(cart)`：`wx.getStorageSync('cart')` / `setStorageSync` 薄封装

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/cart.test.js
const test = require('node:test')
const assert = require('node:assert')
const cart = require('../../../miniprogram/utils/cart')
const g = (id, price, stock) => ({ _id: id, title: '苹果' + id, price, stock, status: 'on_sale', unit: '500g' })

test('同商品重复加购累加数量', () => {
  let c = cart.addItem([], g('a', 1000, 10), 1).cart
  c = cart.addItem(c, g('a', 1000, 10), 2).cart
  assert.strictEqual(c[0].count, 3)
})
test('单商品数量上限99', () => {
  const r = cart.addItem([], g('a', 1000, 999), 120)
  assert.strictEqual(r.cart[0].count, 99)
})
test('合计只统计勾选项', () => {
  let c = cart.addItem([], g('a', 1000, 10), 2).cart
  c = cart.addItem(c, g('b', 500, 10), 3).cart
  c = cart.toggleItem(c, 'b', false)
  assert.deepStrictEqual(cart.sumAmount(c), { totalFen: 2000, count: 2 })
})
test('下架商品被标记失效并取消勾选', () => {
  const c = cart.addItem([], g('a', 1000, 10), 2).cart
  const r = cart.pruneInvalid(c, [{ _id: 'a', status: 'off_sale', stock: 0 }])
  assert.deepStrictEqual(r.invalid, ['a'])
  assert.strictEqual(r.cart[0].invalid, true)
  assert.strictEqual(r.cart[0].checked, false)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/cart.test.js`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `utils/cart.js` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/cart.test.js`
Expected: PASS 4 个用例。

- [ ] **Step 4: 实现购物车页**

`onShow` 时 `load()` 并用 `db.collection('goods').where({_id: _.in(ids)}).get()` 批量拉取商品，调用 `pruneInvalid` 后 `save`。列表项：勾选框、封面、名称、单价、数量步进器（−/+ 调用 `updateCount`）、删除（长按或左滑）。底部栏：全选、合计 `fenToYuan(totalFen)`、"结算(N)"。进入结算前若 `invalid.length > 0`，先 toast "已剔除失效商品"。购物车为空显示 `empty` 组件与"去逛逛"按钮。

- [ ] **Step 5: 手工验证**

Expected：加购后角标数量正确；把某商品在数据库中改为 `off_sale` 后回到购物车，该商品标灰、勾选取消、合计金额同步减少。

- [ ] **Step 6: 提交**

```bash
svn add miniprogram/utils/cart.js miniprogram/pages/cart
svn commit -m "feat: 购物车本地存储与增删改算逻辑"
```

---

### Task 6: 收货地址管理

**Files:**
- Create: `miniprogram/utils/address.js`、`miniprogram/pages/address/list/*`、`miniprogram/pages/address/edit/*`
- Test: `cloudfunctions/common/tests/address.test.js`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Produces: `validateAddress(a) -> { ok: boolean, message?: string }`，规则：`name` 非空且 ≤ 20 字；`phone` 匹配 `/^1[3-9]\d{9}$/`；`region` 为长度 3 的数组；`detail` 非空且 ≤ 100 字。
- 地址数据由客户端直接读写 `addresses` 集合（权限"仅创建者可读写"），不新增云函数。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/address.test.js
const test = require('node:test')
const assert = require('node:assert')
const { validateAddress } = require('../../../miniprogram/utils/address')
const base = { name: '张三', phone: '13800138000', region: ['广东省', '深圳市', '南山区'], detail: '科技园1号' }

test('合法地址通过', () => assert.strictEqual(validateAddress(base).ok, true))
test('手机号非法被拒', () => assert.strictEqual(validateAddress({ ...base, phone: '123' }).ok, false))
test('姓名超长被拒', () => assert.strictEqual(validateAddress({ ...base, name: 'a'.repeat(21) }).ok, false))
test('详细地址超100字被拒', () => assert.strictEqual(validateAddress({ ...base, detail: 'a'.repeat(101) }).ok, false))
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/address.test.js`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现校验并跑通测试**

运行：`node --test cloudfunctions/common/tests/address.test.js`
Expected: PASS 4 个用例。

- [ ] **Step 4: 实现地址页**

列表页：`db.collection('addresses').orderBy('isDefault','desc').orderBy('createdAt','desc').get()`，展示姓名、脱敏手机号（`138****8000`）、完整地址、默认标签；操作：编辑、删除（`wx.showModal` 二次确认）、新增。编辑页：姓名/手机号 `input`、省市区 `picker mode="region"`、详细地址 `textarea`（`maxlength=100`）、"设为默认" `switch`；保存时 `validateAddress` 不通过则 toast 首条错误；设默认时先将该用户其他地址 `isDefault` 置 false（`where({_openid: '{openid}'})` 由安全规则自动限定，用 `db.command.set(false)` 批量更新后再保存本条）。上限 20 条，超出提示。

- [ ] **Step 5: 手工验证**

Expected：新增 → 列表出现；设默认 → 原默认取消；删除 → 列表移除；非法手机号保存被拦截。

- [ ] **Step 6: 提交**

```bash
svn add miniprogram/utils/address.js miniprogram/pages/address
svn commit -m "feat: 收货地址增删改与表单校验"
```

---

### Task 7: 建单云函数（库存扣减与回滚）

**Files:**
- Create: `cloudfunctions/common/lib/stock.js`、`cloudfunctions/common/tests/stock.test.js`、`cloudfunctions/createOrder/index.js`、`cloudfunctions/createOrder/package.json`、`cloudfunctions/createOrder/config.json`
- Modify: `docs/setup-cloud.md`（若集合字段有增减）

**Interfaces:**
- Consumes: `money`、`orderNo`、`pickupCode`、`status`、`errors`、`stock`
- Produces:
  - `stock.deductOne(db, goodsId: string, count: number) -> Promise<{ ok: boolean, reason?: 'not_found'|'off_sale'|'insufficient' }>`
  - `stock.deductAll(db, items: Array<{goodsId, count}>) -> Promise<{ ok: boolean, failed?: { goodsId, reason }, deducted: string[] }>`
  - `stock.rollbackAll(db, items: Array<{goodsId, count}>) -> Promise<void>`
  - `createOrder` 入参 `{ items:[{goodsId, count}], deliveryType:'express'|'pickup', receiver?: {name,phone,region,detail}, pickup?: {storeId}, remark? }`
  - `createOrder` 出参 `{ ok:true, data:{ orderId, orderNo, pickupCode?, payAmount } }`

- [ ] **Step 1: 写库存逻辑失败测试（含 fake db）**

```js
// cloudfunctions/common/tests/stock.test.js
const test = require('node:test')
const assert = require('node:assert')
const { deductOne, deductAll, rollbackAll } = require('../lib/stock')

// fakeDb 契约：command.inc(n)/gte(n) 返回标记对象；collection().where().update() 返回 { stats:{updated} }
function makeDb(stockMap) {
  const calls = []
  const db = {
    command: { inc: n => ({ $inc: n }), gte: n => ({ $gte: n }) },
    collection: () => ({
      doc: id => ({ id }),
      where: q => ({
        update: async () => {
          const id = q._id
          calls.push({ id, count: -q.stock.$inc })
          if (!(id in stockMap) || stockMap[id] < -q.stock.$inc) return { stats: { updated: 0 } }
          stockMap[id] += q.stock.$inc
          return { stats: { updated: 1 } }
        }
      })
    }),
    __calls: calls
  }
  return db
}
```

再写 4 个用例：
1. 库存充足：`deductOne(db, 'a', 2)` → `{ ok:true }`，`stockMap.a === 8`。
2. 库存不足：`deductOne(db, 'a', 20)` → `{ ok:false, reason:'insufficient' }`，库存仍为 10。
3. 批量中途失败：`deductAll(db, [{goodsId:'a',count:2},{goodsId:'b',count:99}])` → `ok:false`、`failed.goodsId === 'b'`，且 `a` 的库存已回滚为原值（断言 `stockMap.a === 10`）。
4. `rollbackAll` 对 `[a,b]` 回滚后库存恢复。

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/stock.test.js`
Expected: FAIL，`stock.js` 不存在。

- [ ] **Step 3: 实现 `stock.js` 并通过测试**

实现要点：`deductOne` 先按 `_id` 查商品（`status`、`stock`），商品不存在 → `not_found`，`status !== 'on_sale'` → `off_sale`，`stock < count` → `insufficient`；再执行条件更新 `where({_id: goodsId, status:'on_sale', stock: db.command.gte(count)}).update({ data:{ stock: db.command.inc(-count), sold: db.command.inc(count) } })`，`stats.updated !== 1` 视为 `insufficient`（并发兜底）。`deductAll` 顺序扣减，失败时对已扣列表 `rollbackAll` 后返回。`rollbackAll` 逐个 `inc(+count)`、`inc(-count)` 回滚 `sold`。

运行：`node --test cloudfunctions/common/tests/stock.test.js`
Expected: PASS 4 个用例。

> fake db 的 `doc` 方法用于 `createOrder` 中读取单个商品，可在实现中统一用 `where({_id}).get()` 以避免依赖 `doc`，两者择一但需让 fake db 与实现保持一致。

- [ ] **Step 4: 实现 `createOrder` 云函数**

流程：
1. `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`，取 `OPENID`，缺失返回 `40301`。
2. 校验 `items` 非空、`count` 为 1–99 整数、`deliveryType` 合法、快递必须有完整 `receiver`、自提必须有 `pickup.storeId`；不合法返回 `40004`。
3. 批量查商品 `where({_id: _.in(ids)})`，任一下架/不存在返回 `40001`。
4. 服务端按 `goods.price * count` 求和得到 `goodsAmount`，读 `config` 取运费配置，`money.calcPayAmount` 得金额；忽略请求中的任何价格字段。
5. `stock.deductAll`，失败时按 `reason` 返回 `40002`（库存不足，message 带上商品名与剩余库存）或 `40001`。
6. 生成 `orderNo`、自提码（仅 `pickup`）、`receiver`/`pickup` 快照；写入 `orders`：`status='pending_pay'`、`_openid=OPENID`、`openid=OPENID`、`items` 含快照字段、`payAmount`、`hiddenByUser=false`、`createdAt=db.serverDate()`。
7. 返回 `{ ok:true, data:{ orderId, orderNo, pickupCode, payAmount } }`。

`createOrder/package.json` 依赖 `wx-server-sdk`，并用 `file:../common` 引入公共库（若云端不支持本地相对依赖，则在部署前把 `common/lib` 复制为 `createOrder/lib`，同一规则适用于所有云函数，需在 `docs/setup-cloud.md` 写明实际采用的方式）。

- [ ] **Step 5: 云端联调**

用真实 `goods` 数据（库存 10）调用 `createOrder`，Expected：返回 `ok:true`，数据库该商品 `stock=8`、`sold+2`，新增订单 `status=pending_pay`、`_openid` 等于调用者 openid、`payAmount` 等于服务端计算值。
再传一个超出库存的 `count`，Expected：`40002`，库存不变、无新订单。

- [ ] **Step 6: 提交**

```bash
svn add cloudfunctions/common/lib/stock.js cloudfunctions/common/tests/stock.test.js cloudfunctions/createOrder
svn commit -m "feat: 建单云函数，下单即扣库存并支持失败回滚"
```

---

### Task 8: 确认订单页与模拟支付

**Files:**
- Create: `cloudfunctions/common/lib/payRules.js`、`cloudfunctions/common/tests/payRules.test.js`、`cloudfunctions/pay/index.js`、`cloudfunctions/pay/package.json`、`miniprogram/pages/order/confirm/*`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Produces: `payRules.assertPayable({ order, cfg, openid }) -> { ok: boolean, code?: number, message?: string }`，规则：
  - 订单 `openid !== openid` → `40301`
  - `status !== 'pending_pay'` → `40003`
  - `cfg.enableMockPay !== true` → `40010`
- `pay` 入参 `{ orderId }`；出参模拟支付成功 `{ ok:true, data:{ mock:true, paidAt } }`。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/payRules.test.js
const test = require('node:test')
const assert = require('node:assert')
const { assertPayable } = require('../lib/payRules')
const order = { openid: 'u1', status: 'pending_pay' }
const cfg = { enableMockPay: true }

test('本人待付款订单可支付', () => assert.strictEqual(assertPayable({ order, cfg, openid: 'u1' }).ok, true))
test('他人订单不可支付', () => assert.strictEqual(assertPayable({ order, cfg, openid: 'u2' }).code, 40301))
test('已支付订单不可重复支付', () => assert.strictEqual(assertPayable({ order: { ...order, status: 'paid' }, cfg, openid: 'u1' }).code, 40003))
test('模拟支付开关关闭时不可支付', () => assert.strictEqual(assertPayable({ order, cfg: { enableMockPay: false }, openid: 'u1' }).code, 40010))
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/payRules.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 `payRules.js` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/payRules.test.js`
Expected: PASS 4 个用例。

- [ ] **Step 4: 实现 `pay` 云函数**

流程：取 `OPENID` → 按 `_id` 查订单（并校验 `openid`）→ 读 `config.enableMockPay` → `assertPayable` 不通过返回对应错误码 → **条件更新** `where({_id: orderId, status:'pending_pay'}).update({ data:{ status:'paid', payInfo:{ type:'mock', paidAt: db.serverDate() }, paidAt: db.serverDate(), updatedAt: db.serverDate() } })` → `stats.updated === 1` 才算成功，否则返回 `40003`（已处理，幂等）。真实微信支付分支留 `if (cfg.payMode === 'wxpay')` 占位，本期返回 `40010`。

- [ ] **Step 5: 实现确认订单页**

从购物车或详情页带参进入：展示商品清单、快递/自提 `radio` 切换（自提时展示门店信息、运费显示 0；快递时展示地址选择、无地址跳地址页）、备注 `textarea`（`maxlength=100`）、金额明细（商品合计/运费/实付全部用服务端返回前先本地按同一规则预览，提交后以服务端返回为准）。提交按钮：置 `submitting=true` 禁用，调 `createOrder`，成功后调 `pay`；`orderId` 用于跳转订单详情；期间任何失败按错误码 toast，`40002` 额外刷新购物车。
快递运费预览必须与 `money.calcFreight` 同规则（5900/800），不得在页面里写死其它数值。

- [ ] **Step 6: 手工验证**

Expected：自提下单 → 订单 `paid` 且有 4 位自提码；快递下单实付 = 商品 + 800（未满 59 元）；连点两次支付按钮，订单只变更一次且第二次提示状态不允许。

- [ ] **Step 7: 提交**

```bash
svn add cloudfunctions/common/lib/payRules.js cloudfunctions/common/tests/payRules.test.js cloudfunctions/pay miniprogram/pages/order/confirm
svn commit -m "feat: 确认订单页与模拟支付云函数"
```

---

### Task 9: 订单列表、订单详情、取消与确认收货

**Files:**
- Create: `cloudfunctions/common/lib/orderRules.js`、`cloudfunctions/common/tests/orderRules.test.js`、`cloudfunctions/cancelOrder/*`、`cloudfunctions/confirmReceive/*`、`miniprogram/pages/order/list/*`、`miniprogram/pages/order/detail/*`、`miniprogram/components/status-tag/*`、`miniprogram/components/price/*`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Produces: `orderRules.canCancel(order) -> { ok, code?, message? }`（`pending_pay` 可取消；其它状态 → `40303`）；`orderRules.canConfirm(order) -> { ok, code?, message? }`（`shipped` 且 `deliveryType==='express'` 才可确认收货，否则 `40003`）。
- `cancelOrder` 入参 `{ orderId, action?: 'cancel' | 'hide' }`：`cancel`（默认）取消订单并回滚库存；`hide` 仅把 `hiddenByUser` 置为 `true`，不改状态、不回滚库存（三者都在这一个云函数内分支，不新增云函数）。
- `cancelOrder({ orderId })`、`confirmReceive({ orderId })` 均返回 `{ ok:true, data:{ orderId, status } }`。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/orderRules.test.js
const test = require('node:test')
const assert = require('node:assert')
const { canCancel, canConfirm } = require('../lib/orderRules')
test('待付款可取消', () => assert.strictEqual(canCancel({ status: 'pending_pay' }).ok, true))
test('已支付不可自助取消', () => assert.strictEqual(canCancel({ status: 'paid' }).code, 40303))
test('仅已发货快递单可确认收货', () => {
  assert.strictEqual(canConfirm({ status: 'shipped', deliveryType: 'express' }).ok, true)
  assert.strictEqual(canConfirm({ status: 'paid', deliveryType: 'express' }).ok, false)
  assert.strictEqual(canConfirm({ status: 'shipped', deliveryType: 'pickup' }).ok, false)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/orderRules.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 `orderRules.js` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/orderRules.test.js`
Expected: PASS 3 个用例。

- [ ] **Step 4: 实现取消与确认收货云函数**

`cancelOrder`：查订单并校验归属 → `canCancel` → 条件更新 `where({_id, status:'pending_pay'}).update({status:'cancelled', cancelReason, closedAt})` → `updated===1` 才调用 `stock.rollbackAll(order.items)`（回滚在状态更新成功后执行，避免重复回滚）。
`confirmReceive`：校验归属 → `canConfirm` → 条件更新 `where({_id, status:'shipped'}).update({status:'completed', completedAt})`。

- [ ] **Step 5: 实现订单列表与详情页**

列表：状态 Tab（全部/待付款/待发货/待收货/待自提/已完成/已取消），映射到 `status` 查询（"待收货" = `shipped`，"待自提" = `paid` 且 `deliveryType='pickup'`）。查询 `db.collection('orders').where({...}).orderBy('createdAt','desc').skip().limit(10)`，安全规则自动限定本人。卡片展示订单号后 6 位、商品缩略图与数量、`payAmount`、`status-tag`、按状态渲染操作按钮（去支付/取消/查看运单/确认收货/出示自提码/再次购买/删除）。
详情：状态时间轴（`createdAt`/`paidAt`/`express.shippedAt`/`completedAt`）、商品清单（下单快照价）、收货信息、金额明细、快递单展示"快递公司 + 运单号 + 复制"（`wx.setClipboardData`），自提单展示自提码与门店信息。
"删除"仅更新 `hiddenByUser=true`（客户端更新 orders 被安全规则禁止，故删除走 `cancelOrder` 同级的 `hideOrder` action —— 为避免新增云函数，复用 `cancelOrder` 增加 `{ action:'hide' }` 入参并在 `docs/setup-cloud.md` 的接口表中登记）。

- [ ] **Step 6: 手工验证**

Expected：下单未支付 → 列表出现"待付款" → 取消 → 状态变已取消且库存回滚；模拟支付 → 待发货；详情页金额明细与订单一致；运单号可复制。

- [ ] **Step 7: 提交**

```bash
svn add cloudfunctions/common/lib/orderRules.js cloudfunctions/common/tests/orderRules.test.js cloudfunctions/cancelOrder cloudfunctions/confirmReceive miniprogram/pages/order miniprogram/components/status-tag miniprogram/components/price
svn commit -m "feat: 订单列表与详情，支持取消订单与确认收货"
```

---

### Task 10: 超时未支付订单自动关闭

**Files:**
- Create: `cloudfunctions/closeExpiredOrders/index.js`、`cloudfunctions/closeExpiredOrders/package.json`、`cloudfunctions/closeExpiredOrders/config.json`
- Test: `cloudfunctions/common/tests/expire.test.js`
- Modify: `cloudfunctions/common/lib/orderRules.js`（新增 `isExpired`）、`docs/setup-cloud.md`（触发器配置已写，需补充实际部署结果）

**Interfaces:**
- Produces: `orderRules.isExpired(createdAt: Date|number, now: Date|number, minutes: number) -> boolean`（`now - createdAt >= minutes * 60000`）。
- 云函数无入参，返回 `{ ok:true, data:{ closed: number } }`。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/expire.test.js
const test = require('node:test')
const assert = require('node:assert')
const { isExpired } = require('../lib/orderRules')
test('超过15分钟视为过期', () => {
  const now = new Date('2026-11-17T12:00:00+08:00').getTime()
  assert.strictEqual(isExpired(now - 15 * 60000, now, 15), true)
})
test('未满15分钟不过期', () => {
  const now = Date.now()
  assert.strictEqual(isExpired(now - 14 * 60000, now, 15), false)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/expire.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 `isExpired` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/expire.test.js`
Expected: PASS 2 个用例。

- [ ] **Step 4: 实现定时云函数**

读 `config.orderTimeoutMinutes`（缺失用 15）→ 分页查 `orders.where({ status:'pending_pay', createdAt: _.lt(new Date(Date.now() - minutes*60000)) })`（每次 100 条，最多循环 10 页）→ 每条做条件更新 `where({_id, status:'pending_pay'}).update({status:'cancelled', cancelReason:'支付超时自动关闭', closedAt})` → `updated===1` 时回滚库存并计数。
`config.json` 填定时触发器 `{"triggers":[{"name":"closeExpired","type":"timer","config":"0 * * * * * *"}]}`。

- [ ] **Step 5: 验证**

手工造一条 `createdAt` 为 20 分钟前的 `pending_pay` 订单（库存已扣）→ 云控制台测试执行 → Expected：订单变 `cancelled`，库存恢复，返回 `closed:1`；再次执行返回 `closed:0`（幂等）。

- [ ] **Step 6: 提交**

```bash
svn add cloudfunctions/closeExpiredOrders cloudfunctions/common/tests/expire.test.js
svn commit -m "feat: 定时关闭超时未支付订单并回滚库存"
```

---

### Task 11: 管理员鉴权与商家入口

**Files:**
- Create: `cloudfunctions/common/lib/auth.js`、`cloudfunctions/common/tests/auth.test.js`、`cloudfunctions/adminCheck/*`
- Modify: `miniprogram/pages/mine/mine.js`、`mine.wxml`

**Interfaces:**
- Produces: `auth.isAdmin(db, openid: string) -> Promise<boolean>`（查 `admins.where({openid}).count()`）；`auth.requireAdmin(db, openid)` 非管理员时抛 `errors.fail(40301, '无权限')`。
- `adminCheck` 返回 `{ ok:true, data:{ isAdmin: boolean } }`。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/auth.test.js
const test = require('node:test')
const assert = require('node:assert')
const { isAdmin } = require('../lib/auth')
const dbWith = n => ({ collection: () => ({ where: () => ({ count: async () => ({ total: n }) }) }) })

test('白名单内返回true', async () => assert.strictEqual(await isAdmin(dbWith(1), 'o1'), true))
test('白名单外返回false', async () => assert.strictEqual(await isAdmin(dbWith(0), 'o2'), false))
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/auth.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 `auth.js` 与 `adminCheck` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/auth.test.js`
Expected: PASS 2 个用例。

- [ ] **Step 4: 「我的」页条件渲染商家入口**

`onShow` 调 `callFn('adminCheck')`，`isAdmin === true` 才渲染"商家管理"区块（商品管理、订单管理、自提核销）。同时展示订单状态入口（待付款/待发货/待收货）与地址管理入口。非管理员不请求、不渲染。

- [ ] **Step 5: 手工验证**

Expected：`admins` 中无当前 openid 时入口不出现；手动向 `admins` 插入当前 openid 后重新进入，"商家管理"出现；在 Console 直接调用 `adminCheck` 返回 `isAdmin:true`，而调用 `adminGoods` 的写操作在无权限账号下返回 `40301`（Task 12 完成后复验）。

- [ ] **Step 6: 提交**

```bash
svn add cloudfunctions/common/lib/auth.js cloudfunctions/common/tests/auth.test.js cloudfunctions/adminCheck miniprogram/pages/mine
svn commit -m "feat: 管理员鉴权与商家入口条件渲染"
```

---

### Task 12: 商家端商品管理（上下架、库存、编辑）

**Files:**
- Create: `cloudfunctions/common/lib/goodsRules.js`、`cloudfunctions/common/tests/goodsRules.test.js`、`cloudfunctions/adminGoods/*`、`miniprogram/pages/admin/goods/list/*`、`miniprogram/pages/admin/goods/edit/*`
- Modify: `miniprogram/app.json`、`docs/setup-cloud.md`（`adminGoods` action 表）

**Interfaces:**
- Produces: `goodsRules.validateGoods(g) -> { ok, message? }`，规则：`title` 非空且 ≤ 30 字；`unit` 非空；`price` 为 > 0 的整数分；`stock` 为 ≥ 0 的整数；`category` 在 `seasonal|imported|cut|gift` 内；`coverUrl` 非空。
- `adminGoods` 入参 `{ action, payload }`，action ∈ `create | update | toggleStatus | setStock | remove`；IR 统一 `{ ok:true, data }`。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/goodsRules.test.js
const test = require('node:test')
const assert = require('node:assert')
const { validateGoods } = require('../lib/goodsRules')
const base = { title: '红富士苹果', unit: '500g', price: 1990, stock: 10, category: 'seasonal', coverUrl: 'cloud://x/a.jpg' }
test('合法商品通过', () => assert.strictEqual(validateGoods(base).ok, true))
test('售价为0被拒', () => assert.strictEqual(validateGoods({ ...base, price: 0 }).ok, false))
test('库存为负被拒', () => assert.strictEqual(validateGoods({ ...base, stock: -1 }).ok, false))
test('标题超30字被拒', () => assert.strictEqual(validateGoods({ ...base, title: 'a'.repeat(31) }).ok, false))
test('缺少封面被拒', () => assert.strictEqual(validateGoods({ ...base, coverUrl: '' }).ok, false))
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/goodsRules.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 `goodsRules.js` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/goodsRules.test.js`
Expected: PASS 5 个用例。

- [ ] **Step 4: 实现 `adminGoods` 云函数**

首行 `requireAdmin`（Task 11），再按 action 分支：
- `create`：`validateGoods` → 写 `status='on_sale'`、`sold=0`、`specs=[]`、`sort` 默认 999、时间戳。
- `update`：`validateGoods` → `doc(id).update`，只允许白名单字段（禁止改 `sold`）。
- `toggleStatus`：`{ id, status }`，仅接受 `on_sale|off_sale`。
- `setStock`：`{ id, stock }`，`stock` 为 ≥ 0 整数，直接覆盖（不参与订单回滚）。
- `remove`：先 `orders.where({'items.goodsId': id}).count()`，大于 0 返回 `40004` "该商品已有订单，请改为下架"；否则物理删除商品与云存储图片（`cloud.deleteFile`，失败忽略）。

- [ ] **Step 5: 实现商家商品列表与编辑页**

列表：全部商品，按 `status`/`sort` 排序，项展示缩略图、名称、价格、库存、销量；行内操作：上下架 `switch`（调 `toggleStatus`）、库存 `−/输入/+`（调 `setStock`，输入用 `wx.showModal` 数值校验）、编辑、删除。顶部"+ 新增商品"。
编辑页：表单字段与 `validateGoods` 一一对应，价格以元输入、保存时 `yuanToFen`；封面与轮播图用 `wx.chooseMedia({ count: 5, mediaType: ['image'], sizeType: ['compressed'] })` 选图，上传前校验单张 `size <= 300 * 1024`（超出则提示"图片过大，请重新选择"并阻止上传，不静默上传），再用 `wx.cloud.uploadFile` 上传至 `goods/${Date.now()}-${i}.jpg`，最多 5 张，支持删除；分类用 `picker`。提交时 `validateGoods` 不通过则 toast。

- [ ] **Step 6: 手工验证**

Expected：新增商品 → 顾客端列表可见；下架 → 顾客端列表消失、原详情提示已下架；库存改为 0 → 顾客端显示已售罄；有订单的商品删除被拒并提示；无权限账号调用 `adminGoods` 返回 `40301`。

- [ ] **Step 7: 提交**

```bash
svn add cloudfunctions/common/lib/goodsRules.js cloudfunctions/common/tests/goodsRules.test.js cloudfunctions/adminGoods miniprogram/pages/admin/goods
svn commit -m "feat: 商家商品管理，支持上下架、改库存与图片上传"
```

---

### Task 13: 商家订单管理、发货与自提核销

**Files:**
- Create: `cloudfunctions/common/lib/pickupRules.js`、`cloudfunctions/common/tests/pickupRules.test.js`、`cloudfunctions/adminOrder/*`、`cloudfunctions/verifyPickup/*`、`miniprogram/pages/admin/order/list/*`、`ship/*`、`verify/*`
- Modify: `miniprogram/app.json`、`docs/setup-cloud.md`（`pickupAttempts` 集合字段说明）

**Interfaces:**
- Produces:
  - `pickupRules.assertCanShip(order) -> { ok, code?, message? }`：`deliveryType==='express'` 且 `status==='paid'`，否则 `40003`。
  - `pickupRules.assertCanVerify(order, code, attempt) -> { ok, code?, message?, remaining?: number }`：订单须 `deliveryType==='pickup'` 且 `status==='paid'`；`attempt.lockedUntil > Date.now()` → 返回"已锁定"；`code !== order.pickup.code` → `ok:false` 且 `remaining = 3 - (attempt.fails + 1)`。
  - `adminOrder` action ∈ `list | ship | markRefunded`；`verifyPickup({ orderId?, code })`。

- [ ] **Step 1: 写失败测试**

```js
// cloudfunctions/common/tests/pickupRules.test.js
const test = require('node:test')
const assert = require('node:assert')
const { assertCanShip, assertCanVerify } = require('../lib/pickupRules')
const expressPaid = { deliveryType: 'express', status: 'paid' }
const pickupPaid = { deliveryType: 'pickup', status: 'paid', pickup: { code: '1234' } }

test('已支付快递单可发货', () => assert.strictEqual(assertCanShip(expressPaid).ok, true))
test('自提单不可发货', () => assert.strictEqual(assertCanShip(pickupPaid).code, 40003))
test('未支付不可发货', () => assert.strictEqual(assertCanShip({ ...expressPaid, status: 'pending_pay' }).code, 40003))
test('自提码正确可核销', () => assert.strictEqual(assertCanVerify(pickupPaid, '1234', { fails: 0 }).ok, true))
test('自提码错误返回剩余次数', () => {
  const r = assertCanVerify(pickupPaid, '9999', { fails: 0 })
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.remaining, 2)
})
test('锁定期间不可核销', () => {
  const r = assertCanVerify(pickupPaid, '1234', { fails: 3, lockedUntil: Date.now() + 60000 })
  assert.strictEqual(r.ok, false)
})
```

- [ ] **Step 2: 运行确认失败**

运行：`node --test cloudfunctions/common/tests/pickupRules.test.js`
Expected: FAIL。

- [ ] **Step 3: 实现 `pickupRules.js` 并跑通测试**

运行：`node --test cloudfunctions/common/tests/pickupRules.test.js`
Expected: PASS 6 个用例。

- [ ] **Step 4: 实现 `adminOrder` 与 `verifyPickup`**

`adminOrder.list`：按 `status` 与 `deliveryType` 过滤，`orderBy('createdAt','desc')` 分页 10 条，返回买家昵称占位（openid 后 6 位）、商品摘要、金额。
`adminOrder.ship`：`assertCanShip` → 校验 `company` 在枚举 `['SF','JD','ZTO','YTO','YUNDA','EMS','OTHER']`、`trackingNo` 非空 → 条件更新 `where({_id, status:'paid'}).update({ status:'shipped', express:{ company, companyCode, trackingNo, shippedAt: db.serverDate() } })`，`updated!==1` 返回 `40003`。
`verifyPickup`：`requireAdmin` → 按 `code` 查 `paid + pickup` 订单（同时支持传 `orderId`）→ 读 `pickupAttempts` 中当前商家记录 → `assertCanVerify` → 失败时更新 `fails`，连续 3 次写 `lockedUntil = now + 5 分钟` 并清零计数；成功时条件更新订单为 `completed` 并清空该商家失败计数。

- [ ] **Step 5: 实现三个商家页面**

订单管理列表：Tab（待发货/待自提/待收货/已完成/全部），项展示订单号、商品摘要、金额、下单时间；"发货"跳发货页；自提单显示"核销"入口。
发货页：展示收货信息（可复制），快递公司 `picker`（中文名 → code 映射），运单号 `input`，提交调 `adminOrder.ship`，成功返回列表并刷新。
核销页：输入框（`type="number"`，`maxlength=4`）+ "扫码"按钮（`wx.scanCode`，解析结果中的 4 位数字）+ 核销按钮，展示结果（成功/剩余次数/已锁定）。

- [ ] **Step 6: 手工验证**

Expected：待发货订单发货后变"待收货"，顾客端能看到运单号；对已发货订单再次发货提示状态不允许；自提订单输入正确码 → 完成；连续输错 3 次 → 提示锁定，5 分钟内正确码也被拒。

- [ ] **Step 7: 提交**

```bash
svn add cloudfunctions/common/lib/pickupRules.js cloudfunctions/common/tests/pickupRules.test.js cloudfunctions/adminOrder cloudfunctions/verifyPickup miniprogram/pages/admin/order
svn commit -m "feat: 商家订单管理、发货与自提核销"
```

---

### Task 14: 并发、幂等与验收清单执行

**Files:**
- Modify: 按缺陷修复涉及的既有文件
- Create: `docs/acceptance-record.md`（执行记录，含用例、结果、缺陷与修复提交号）

**Interfaces:** 无新增接口；复用 Task 7–13 的云函数。

- [ ] **Step 1: 库存并发验证**

造 1 个库存为 1 的商品，用两个微信号（开发者工具多账号调试 + 真机各一）几乎同时提交 `createOrder`。
Expected：仅 1 单成功；另一单返回 `40002`；`goods.stock === 0` 且 `sold === 1`。若出现负库存，回到 Task 7 修正后重跑。

- [ ] **Step 2: 多商品回滚验证**

商品 A 库存 10、B 库存 1，提交 `[{A,2},{B,5}]`。
Expected：整单失败，A 库存仍为 10、B 仍为 1，无新订单。

- [ ] **Step 3: 幂等验证**

对同一订单连续调用 `pay` 3 次、`cancelOrder` 2 次、`verifyPickup` 2 次。
Expected：`pay` 第 2、3 次返回 `40003`；`cancelOrder` 只回滚一次库存；`verifyPickup` 第二次返回状态不允许。

- [ ] **Step 4: 权限验证**

确认 `initDb` 已按 Task 3 要求从云端删除（控制台云函数列表中不存在）。再用非管理员账号直接调用 `adminGoods`、`adminOrder`、`verifyPickup`。
Expected：三个云函数均返回 `40301`，且数据库无任何变更。

- [ ] **Step 5: 按需求文档第 9 节逐条执行验收**

逐条执行 `docs/fruit-shop-miniapp-requirements.md` 第 9 节 9.1（10 条）、9.2（6 条）、9.3（4 条），在 `docs/acceptance-record.md` 记录每条结果与证据（截图路径或云函数日志时间）。
Expected：全部通过；未通过项修复后重跑并记录修复的 SVN 版本号。

- [ ] **Step 6: 提交**

```bash
svn add docs/acceptance-record.md
svn commit -m "test: 完成并发、幂等与验收清单执行记录"
```

---

## 不在本计划范围

以下属于需求文档 P4 / Out of Scope，本计划不实现，但结构已预留：

- 真实微信支付（`pay` 的 `wxpay` 分支与 `payCallback`）
- 物流轨迹 API、订阅消息、优惠券、多规格 SKU、多商家、Web 管理后台
