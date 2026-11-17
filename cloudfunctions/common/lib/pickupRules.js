/** 发货与自提核销规则（纯函数）：只判断能不能做，不读写数据库。 */

const { CODES } = require('./errors')

const MAX_FAILS = 3

function assertCanShip(order) {
  if (!order) return { ok: false, code: CODES.PARAM_INVALID, message: '订单不存在' }
  if (order.deliveryType !== 'express') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '自提订单无需发货' }
  }
  if (order.status !== 'paid') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '当前状态不可发货' }
  }
  return { ok: true }
}

function nextFail(attempt) {
  const fails = (Number(attempt && attempt.fails) || 0) + 1
  const remaining = Math.max(0, MAX_FAILS - fails)
  return {
    fails,
    remaining,
    locked: remaining === 0,
    code: CODES.PARAM_INVALID,
    ok: false,
    message: remaining > 0 ? '自提码错误，还可尝试 ' + remaining + ' 次' : '错误次数过多，已锁定 5 分钟'
  }
}

function assertCanVerify(order, code, attempt) {
  const record = attempt || {}
  const now = Date.now()

  if (!order) return { ok: false, code: CODES.PARAM_INVALID, message: '订单不存在' }
  if (order.deliveryType !== 'pickup') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '该订单不是自提订单' }
  }
  if (order.status !== 'paid') {
    return { ok: false, code: CODES.ORDER_STATUS_INVALID, message: '当前状态不可核销' }
  }
  if (record.lockedUntil && record.lockedUntil > now) {
    return { ok: false, code: CODES.PARAM_INVALID, message: '错误次数过多，已锁定 5 分钟' }
  }

  const expected = order.pickup && order.pickup.code
  if (!expected || String(code) !== String(expected)) {
    return nextFail(record)
  }

  return { ok: true }
}

module.exports = { assertCanShip, assertCanVerify, nextFail, MAX_FAILS }
