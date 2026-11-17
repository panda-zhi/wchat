/**
 * 取消订单 / 隐藏订单。
 * action='cancel'（默认）：pending_pay → cancelled，状态更新成功后才回滚库存，避免重复回滚。
 * action='hide'：仅把 hiddenByUser 置 true，不改状态、不回滚库存。
 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { canCancel } = require('../common/lib/orderRules')
const { ORDER_STATUS } = require('../common/lib/status')
const { rollbackAll } = require('../common/lib/stock')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(CODES.FORBIDDEN, '请在小程序内操作')

  const orderId = event && event.orderId
  if (!orderId || typeof orderId !== 'string') return fail(CODES.PARAM_INVALID, '参数错误')

  const res = await db.collection('orders').where({ _id: orderId }).get()
  const order = (res.data && res.data[0]) || null
  if (!order) return fail(CODES.PARAM_INVALID, '订单不存在')
  if (order.openid !== OPENID) return fail(CODES.FORBIDDEN, '无权操作该订单')

  if (event.action === 'hide') {
    await db.collection('orders').where({ _id: orderId, openid: OPENID }).update({
      data: { hiddenByUser: true, updatedAt: db.serverDate() }
    })
    return ok({ orderId, status: order.status })
  }

  const check = canCancel(order)
  if (!check.ok) return fail(check.code, check.message)

  const upd = await db.collection('orders').where({
    _id: orderId,
    status: ORDER_STATUS.PENDING_PAY
  }).update({
    data: {
      status: ORDER_STATUS.CANCELLED,
      cancelReason: (event && event.reason) || '用户取消',
      closedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  if (!upd.stats || upd.stats.updated !== 1) {
    return fail(CODES.CANNOT_CANCEL, '订单状态已变更，请刷新后重试')
  }

  await rollbackAll(db, order.items || [])
  return ok({ orderId, status: ORDER_STATUS.CANCELLED })
}
