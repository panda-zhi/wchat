# 验收记录

> 执行日期：2026-11-17
> 执行范围：**仅本地开发验证**（无小程序 AppID、无云开发环境、无第二个微信号），按用户要求暂不提交 SVN。
> 判定口径：
> - **本地通过**：有单测或静态检查作为证据，可复现。
> - **待云端**：依赖真实云环境（数据库、存储、定时触发器、多账号）才能验证，本轮不判定通过，也不视为缺陷。
> - 缺陷列记录本轮本地发现并已修复的问题；SVN 修订号留空（未提交）。

## 1. 本地验证结果

复现命令：`node --test cloudfunctions/common/tests/`
当前结果：**59 passed / 0 failed**（12 个测试文件）。

| 需求条目 | 验收点 | 本地结论 | 证据 |
| --- | --- | --- | --- |
| 9.1-1 | 列表只取 `on_sale`；下架商品详情展示「已下架」且不可购买 | 本地通过（静态核对） | `pages/index/index.js` where `status:'on_sale'`；`utils/goods.js` `decorateStock` 对非 `on_sale` 返回 `buyable:false` |
| 9.1-2 | 库存 0 显示「已售罄」并禁用购买 | 本地通过 | `goodsDisplay.test.js` |
| 9.1-3 | 加购、改数量、删除、全选、合计计算 | 本地通过 | `cart.test.js`（10 条） |
| 9.1-4 | 满 59 元免运费、否则 8 元；自提运费恒 0；合计正确 | 本地通过 | `money.test.js` |
| 9.1-5 | 下单扣库存；取消/超时关单回滚库存 | 本地通过（逻辑层） | `stock.test.js`（5 条）、`expire.test.js`（2 条） |
| 9.1-6 | 支付成功后 `pending_pay → paid`，重复支付被拒 | 本地通过（逻辑层） | `payRules.test.js`（4 条） |
| 9.1-7 | 订单详情展示快递公司与运单号、可复制 | 本地通过（静态核对） | `pages/order/detail/detail.wxml` 运单号区块 + `onCopyTracking` |
| 9.1-8 | 自提订单展示 4 位自提码与门店信息 | 本地通过（静态核对） | `detail.wxml` 自提区块；`pickupCode.test.js` |
| 9.1-9 | 订单列表状态 Tab 与分页 | 待云端 | 需真实订单数据与安全规则联动 |
| 9.1-10 | 地址新增/编辑/设默认，默认地址自动带入 | 本地通过（校验逻辑） | `address.test.js`（6 条）；确认页取默认地址待实机 |
| 9.2-1 | 非白名单看不到入口；直接调用 `adminGoods` 返回 40301 | 本地通过（逻辑层） | `auth.test.js`；`adminGoods` / `adminOrder` / `verifyPickup` 首行 `requireAdmin` |
| 9.2-2 | 新增商品顾客端可见；下架立即不可购买 | 待云端 | 依赖商品集合读写与列表刷新 |
| 9.2-3 | 库存快捷修改后顾客端库存状态同步 | 待云端 | 依赖真实数据库 |
| 9.2-4 | 仅 `paid + express` 可发货，重复发货被拒 | 本地通过（规则层） | `pickupRules.test.js` 发货 3 条 |
| 9.2-5 | 自提码正确→完成；错误提示剩余次数；已核销再核销被拒 | 本地通过（规则层） | `pickupRules.test.js` 核销 3 条；`verifyPickup` 对非 `paid` 返回 40003 |
| 9.2-6 | 有订单的商品不可删除 | 本地通过（静态核对） | `adminGoods.remove` 先 `orders.where({'items.goodsId'}).count()` |
| 9.3-1 | 库存 1 两人同抢，仅 1 单成功且不为负 | 本地通过（条件更新逻辑）、并发待云端 | `stock.test.js` `deductOne` 条件更新 |
| 9.3-2 | 多商品某件不足，整单失败且已扣库存回滚 | 本地通过 | `stock.test.js` `deductAll` 回滚 |
| 9.3-3 | 重复支付只变更一次状态 | 本地通过（逻辑层） | `payRules.test.js` + `pay` 条件更新 |
| 9.3-4 | 断网提交不产生脏订单（或由超时任务关闭） | 本地通过（关单逻辑） | `expire.test.js`；`createOrder` 写单失败即回滚库存 |

## 2. 计划 Task 14 四个专项

| 步骤 | 内容 | 结果 |
| --- | --- | --- |
| Step 1 | 双账号并发下单 | 待云端（需 AppID + 两个微信号；本地仅有条件更新单测） |
| Step 2 | 多商品回滚 | 本地通过（`stock.test.js`），云端待复跑 |
| Step 3 | `pay` ×3 / `cancelOrder` ×2 / `verifyPickup` ×2 幂等 | 待云端（结构上均由条件更新或状态校验保证，本地单测覆盖规则层） |
| Step 4 | 非管理员直接调用三个 admin 云函数返回 40301 | 本地通过（`auth.test.js` + 静态核对），云端待复验 |

## 3. 本轮本地发现与修复

| # | 问题 | 修复 |
| --- | --- | --- |
| 1 | 核销时错误自提码查不到订单会直接返回「未找到订单」，不累计失败次数，可无限试码 | `verifyPickup` 在无匹配订单时同样按商家累计失败次数并触发 5 分钟锁定；`pickupRules` 抽出 `nextFail` 复用 |
| 2 | 已核销订单带 `orderId` 再次核销时，因查询附带 `status:'paid'` 被当作「订单不存在」 | `loadOrder` 在传 `orderId` 时不加状态过滤，交由 `assertCanVerify` 返回 `40003 当前状态不可核销` |

SVN 修订号：未提交（用户要求仓库地址稍后提供）。

## 4. 待云端执行清单

1. 按 `docs/setup-cloud.md` 部署 `common` → `initDb` → 其余云函数，执行初始化后**删除 `initDb`**。
2. 配置五个集合的安全规则与索引、`closeExpiredOrders` 触发器。
3. `admins` 插入商家 openid；用两个微信号执行 9.3-1 并发用例。
4. 逐条执行 9.1 / 9.2 的 UI 用例，补齐截图或云函数日志时间作为证据。
5. 本轮标记「待云端」的条目全部通过后，把本文件对应行改为「通过」并补 SVN 修订号。
