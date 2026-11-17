/** 支付前置校验（纯函数）。支付方式分支与开关判断都在这里，云函数只负责读写。 */

const { CODES } = require('./errors')

function assertPayable({ order, cfg, openid }) {
  if (!order) return { ok: false, code: CODES.PARAM_INVALID, message: '订单不存在' }
  if (order.openid !== openid) return { ok: false, code: CODES.FORBIDDEN, message: '无权操作该订单' }
  if (order.status !== 'pending_pay') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '订单状态不允许支付' }
  }
  const conf = cfg || {}
  if (conf.payMode === 'wxpay') return { ok: false, code: CODES.PAY_NOT_OPEN, message: '微信支付未开通' }
  if (conf.enableMockPay !== true) {
    return { ok: false, code: CODES.PAY_NOT_OPEN, message: '支付未开通' }
  }
  return { ok: true }
}

module.exports = { assertPayable }
