# SDD ledger — plan: h:\wchat\docs\superpowers\plans\2026-11-17-fruit-shop-miniapp.md

Mode: local-only — 用户要求「先不提交，只做本地开发，仓库地址稍后提供」。

Task 1: Ruling: 跳过 Task 1 Step 1（svn info）与 Step 6（svn add/commit） — 用户明确暂不提交，且 h:\wchat 尚不是 SVN 工作副本 — 代价：改动无修订号可追溯，回滚需手工处理
Task 1: Ruling: 台账改为手工维护，不调用 task-start.ps1 / task-done.ps1 — 两脚本依赖 svn info --show-item wc-root，本地非工作副本会直接失败 — 代价：完成行不含修订号，仅记录测试命令与结果
Task 1: complete (local, checks: node --check ×5 + JSON 解析 ×5 → PASS；开发者工具编译需人工确认)
Task 2: Ruling: orderNo 测试改用本地时间构造 new Date(2026, 10, 17) 而非带 +08:00 的 ISO 字符串 — 避免测试依赖运行机器时区，实现同样取本地时间 — 代价：无
Task 2: complete (local, tests: node --test cloudfunctions/common/tests/ → 10 passed / 0 failed)
Task 3: Ruling: 跳过 Step 3/Step 4 的云端部署与实机执行（需 AppID + 云环境，当前无） — 仅交付代码与手册，部署执行留给用户按 docs/setup-cloud.md 操作 — 代价：幂等性与权限规则未经云端实测
Task 3: complete (local, checks: node --check initDb/index.js + JSON 解析 package.json → PASS；common 测试回归 10 passed / 0 failed)
Task 4: Ruling: 详情页「加入购物车/立即购买」改为写 Storage + toast，不跳转（购物车页与确认订单页尚未创建，navigateTo 会失败） — 待 Task 5 / Task 9 页面就绪后接入跳转 — 代价：Task 4 手工验证只看到 toast
Task 4: complete (local, tests: goodsDisplay + format → 5 passed；全量 common 测试 15 passed / 0 failed；语法与 JSON 校验 PASS)
Task 5: complete (local, tests: cart.test.js 10 passed；全量 25 passed / 0 failed；语法与 JSON 校验 PASS)
Task 6: Ruling: 设默认地址时不用 `where().update()` 批量置 false（小程序端不支持批量更新，仅云函数可用），改为 `where({isDefault:true}).get()` 后逐条 `doc().update()` — 代价：地址 ≤20 条时最多 20 次请求
Task 6: complete (local, tests: address.test.js 6 passed；全量 31 passed / 0 failed；语法与 JSON 校验 PASS)
Task 7: Ruling: stock 测试的 fakeDb 用 `where({_id}).get()` 读商品、不用 `doc()` — 与实现统一走 where，fake 只需覆盖一种查询形态（计划 Step 3 注释允许二者择一） — 代价：无
Task 7: Ruling: 跳过 Step 5 云端联调（需 AppID + 云环境） — 建单流程仅经 fakeDb 单测与语法校验，真实数据库行为留待部署后按手册验证 — 代价：`_.in` 批量查商品、`db.serverDate()` 与 orders 写入未经云端实测
Task 7: complete (local, tests: stock.test.js 5 passed；全量 36 passed / 0 failed；node --check createOrder/index.js + stock.js PASS)
Task 8: Ruling: 把运费预览常量 FREIGHT_FREE_THRESHOLD=5900 / FREIGHT_FEE=800 加到 `miniprogram/utils/config.js`，确认页引用而不写死 — 页面拿不到 config 集合（客户端不可读），且计划要求预览与 calcFreight 同规则 — 代价：改运费需同步两处
Task 8: Ruling: `stores` 安全规则由 `read:false` 改为 `read:true`，并同步 docs/setup-cloud.md — 确认订单页自提模式需要展示门店名/地址/电话/营业时间，这些属公开信息；不开新云函数 — 代价：门店数据对客户端公开（无敏感字段）
Task 8: Ruling: 支付成功后暂无订单详情页可跳（Task 9 才创建），改为 toast + navigateBack；购物车已剔除已下单商品 — Task 9 创建详情页后改成 redirectTo 订单详情 — 代价：本期支付成功只能通过订单列表确认（列表同样在 Task 9）
Task 8: Ruling: 跳过 Step 6 手工验证（需 AppID + 云环境） — 模拟支付链路仅经 payRules 单测与语法校验 — 代价：createOrder→pay 串联、条件更新幂等未经云端实测
Task 8: complete (local, tests: payRules.test.js 4 passed；全量 40 passed / 0 failed；node --check pay/payRules/confirm.js + JSON 解析 PASS)
Task 9: Ruling: 新增 `format.formatDateTime(value)` 并补 2 条测试 — 订单详情时间轴需要统一时间展示，原先 format.js 只有金额函数 — 代价：无
Task 9: Ruling: 支付成功后确认页由 navigateBack 改为 `redirectTo` 订单详情（Task 8 预留项的收尾） — 详情页已创建 — 代价：返回键回到已清空的购物车
Task 9: Ruling: 跳过 Step 6 手工验证（需 AppID + 云环境） — 订单列表/详情/取消/确认收货仅经 orderRules 单测与语法校验 — 代价：客户端 where/orderBy/skip 分页与安全规则联动未经实测
Task 9: complete (local, tests: orderRules.test.js 3 passed + format 新增 1 passed；全量 44 passed / 0 failed；node --check ×9 + JSON 解析 PASS)
Task 10: Ruling: 跳过 Step 5 云端验证（需 AppID + 云环境，无法造 20 分钟前的真实订单） — 幂等逻辑靠「条件更新成功才回滚」的结构保证，单测只覆盖 isExpired — 代价：触发器实际执行、分页扫描与库存回滚未经云端实测
Task 10: complete (local, tests: expire.test.js 2 passed；全量 46 passed / 0 failed；node --check + config.json 解析 PASS)
Task 11: Ruling: 「我的」页商家入口跳转的 admin 页面在 Task 12/13 才创建，当前导航到未注册路径会提示页面不存在 — 页面与入口文案先落位，Task 12/13 建页后自动可用 — 代价：本轮手工验证只能确认入口显隐，不能走通跳转
Task 11: Ruling: 跳过 Step 5 云端手工验证（需 AppID + 云环境与真实 admins 数据） — isAdmin 仅经 fakeDb 单测，adminCheck 与页面条件渲染未经实机验证 — 代价：安全规则下 admins 客户端不可读这一前提未实测
Task 11: complete (local, tests: auth.test.js 2 passed；全量 48 passed / 0 failed；node --check adminCheck/auth/mine.js + package.json 解析 PASS)
Task 12: Ruling: 商家商品列表不走 adminGoods 新增 action，客户端直接读 goods 集合（安全规则 read:true），按 status desc + sort asc 分页 — 计划未定义 list action，collect 读权限已够用 — 代价：列表仅能看到 safety rule 允许的字段，且排序索引需后续按手册补
Task 12: Ruling: 库存加减与「点数字改库存」都走 setStock，showModal(editable) 做整数校验；上下架失败时回滚开关显示 — 计划要求行内操作与 showModal 校验 — 代价：无
Task 12: Ruling: 编辑页在客户端复刻了一份表单级校验（标题/单位/售价/库存/封面），服务端 goodsRules 仍是唯一权威 — 避免为分享一个纯函数引入跨端构建 — 代价：两处规则需同步维护
Task 12: Ruling: 跳过 Step 6 云端手工验证（需 AppID + 云环境与真实图片存储） — validateGoods 仅经单测，adminGoods 五个 action 与图片上传/删除未经实机验证 — 代价：cloud.deleteFile 失败忽略、orders 关联删除拦截未经真实数据确认
Task 12: complete (local, tests: goodsRules.test.js 5 passed；全量 53 passed / 0 failed；node --check adminGoods/list/edit + 4 个 JSON 解析 PASS)
Task 13: Ruling: orders 安全规则仅允许下单人客户端读取，发货页无法自行拉单，改为列表页把订单对象放进 app.globalData.adminShipOrder 再跳转 — 未新增 adminOrder.detail action，保持计划登记的 3 个 action — 代价：直接刷新/深链进入发货页会提示「未获取到订单信息」
Task 13: Ruling: ship 入参用 companyCode（枚举 SF/JD/...），express 内同时存中文 company 与 companyCode — 计划写「company 在枚举」但又要中文展示，故拆成两字段 — 代价：无
Task 13: Ruling: markRefunded 仅把 paid/shipped 置为 refunded 并写 refundedAt，不回滚库存、不接真实退款 — 计划只要求「标记退款」 — 代价：一期模拟支付下无资金流，二期接微信支付时需补退款调用
Task 13: Ruling: 核销页从列表进入时带 orderId（仍要求输入/扫描自提码比对），扫码结果用 /\d{4}/ 提取 4 位数字 — 计划要求同时支持 orderId 与 code — 代价：无
Task 13: Ruling: 跳过 Step 6 云端手工验证（需 AppID + 云环境与两个真实账号） — assertCanShip/assertCanVerify 经 6 条单测，adminOrder 与 verifyPickup 的数据库分支未经实机验证 — 代价：pickupAttempts upsert、pickup.verifiedAt 嵌套更新、发货条件更新并发行为未实测
Task 13: complete (local, tests: pickupRules.test.js 6 passed；全量 59 passed / 0 failed；node --check ×6 + 6 个 JSON 解析 PASS)
Task 14: Ruling: 自审发现并修复两个核销缺陷 — ①错误自提码查不到订单时不计失败次数（可无限试码），改为同样累计并触发锁定；②已核销订单带 orderId 再次核销被当作「订单不存在」，改为 loadOrder 传 orderId 时不加状态过滤、由 assertCanVerify 返回 40003 — 两项均为本地静态审查结论，云端未复验
Task 14: Ruling: 计划 Step 1（双账号并发）、Step 3（云端连续调用幂等）、Step 4（云端权限实测）标记「待云端」 — 无 AppID/云环境/第二账号，本地只覆盖规则层与条件更新结构 — 代价：验收记录中这些条目不计为通过
Task 14: Ruling: 验收记录不写 SVN 修订号，改记「未提交（用户要求仓库地址稍后提供）」 — 与本地开发模式一致
Task 14: complete (local, docs/acceptance-record.md 已建：9.1×10 + 9.2×6 + 9.3×4 逐条结论与证据；回归 59 passed / 0 failed；node --check adminOrder/verifyPickup/pickupRules PASS)
