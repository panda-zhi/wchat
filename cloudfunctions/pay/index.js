/**
 * 支付云函数（一期模拟支付）。
 * 二期真实微信支付：在 payMode === 'wxpay' 分支内调用 cloud.cloudPay.unifiedOrder，
 * 回调由独立云函数按 outTradeNo 幂等处理，本函数的页面调用契约不变。
 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { assertPayable } = require('../common/lib/payRules')
const { ORDER_STATUS } = require('../common/lib/status')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function readConfig() {
  const res = await db.collection('config').where({ key: 'enableMockPay' }).get()
  const doc = (res.data && res.data[0]) || null
  return { enableMockPay: doc ? doc.value === true : false, payMode: 'mock' }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(CODES.FORBIDDEN, '请在小程序内操作')
  const orderId = event && event.orderId
  if (!orderId || typeof orderId !== 'string') return fail(CODES.PARAM_INVALID, '参数错误')

  const res = await db.collection('orders').where({ _id: orderId }).get()
  const order = (res.data && res.data[0]) || null
  if (!order) return fail(CODES.PARAM_INVALID, '订单不存在')

  const cfg = await readConfig()
  const check = assertPayable({ order, cfg, openid: OPENID })
  if (!check.ok) return fail(check.code, check.message)

  const paidAt = new Date()
  const upd = await db.collection('orders').where({
    _id: orderId,
    status: ORDER_STATUS.PENDING_PAY
  }).update({
    data: {
      status: ORDER_STATUS.PAID,
      payInfo: { type: 'mock', paidAt: db.serverDate() },
      paidAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  if (!upd.stats || upd.stats.updated !== 1) {
    // 并发/重复点击：另一请求已改状态，按幂等返回状态不允许，不重复扣款或改单。
    return fail(CODES.ORDER_STATUS_INVALID, '订单状态已变更，请刷新后查看')
  }

  return ok({ mock: true, paidAt: paidAt.getTime() })
}
