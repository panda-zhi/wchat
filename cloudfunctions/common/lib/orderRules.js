/** 订单操作规则（纯函数）：只能在什么状态下做什么，与云函数读写解耦。 */

const { CODES } = require('./errors')

function canCancel(order) {
  if (!order) return { ok: false, code: CODES.PARAM_INVALID, message: '订单不存在' }
  if (order.status !== 'pending_pay') {
    return { ok: false, code: CODES.CANNOT_CANCEL, message: '当前状态不可取消' }
  }
  return { ok: true }
}

function canConfirm(order) {
  if (!order) return { ok: false, code: CODES.PARAM_INVALID, message: '订单不存在' }
  if (order.status !== 'shipped') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '仅待收货订单可确认收货' }
  }
  if (order.deliveryType !== 'express') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '自提订单无需确认收货' }
  }
  return { ok: true }
}

function isExpired(createdAt, now, minutes) {
  const created = createdAt instanceof Date ? createdAt.getTime() : Number(createdAt)
  const current = now instanceof Date ? now.getTime() : Number(now)
  if (!Number.isFinite(created) || !Number.isFinite(current)) return false
  const limit = (Number(minutes) || 0) * 60000
  return current - created >= limit
}

module.exports = { canCancel, canConfirm, isExpired }
