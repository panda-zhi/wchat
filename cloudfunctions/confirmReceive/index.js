/** 确认收货：仅本人、仅已发货的快递单，可完成订单。 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { canConfirm } = require('../common/lib/orderRules')
const { ORDER_STATUS } = require('../common/lib/status')

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

  const check = canConfirm(order)
  if (!check.ok) return fail(check.code, check.message)

  const upd = await db.collection('orders').where({
    _id: orderId,
    status: ORDER_STATUS.SHIPPED
  }).update({
    data: {
      status: ORDER_STATUS.COMPLETED,
      completedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  if (!upd.stats || upd.stats.updated !== 1) {
    return fail(CODES.ORDER_STATUS_INVALID, '订单状态已变更，请刷新后重试')
  }

  return ok({ orderId, status: ORDER_STATUS.COMPLETED })
}
