/**
 * 自提码核销云函数。
 * 首步鉴权；按自提码或 orderId 定位 paid + pickup 订单；连续 3 次错误锁定 5 分钟。
 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { requireAdmin } = require('../common/lib/auth')
const { assertCanVerify, nextFail } = require('../common/lib/pickupRules')
const { ORDER_STATUS } = require('../common/lib/status')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const LOCK_MS = 5 * 60 * 1000

async function loadOrder(payload) {
  // 传 orderId 时不加状态过滤，让 assertCanVerify 区分「不存在」与「状态不允许」。
  if (payload.orderId) {
    const res = await db.collection('orders').where({ _id: payload.orderId }).get()
    return (res.data && res.data[0]) || null
  }
  if (!payload.code) return null
  const res = await db.collection('orders').where({
    status: ORDER_STATUS.PAID,
    deliveryType: 'pickup',
    'pickup.code': String(payload.code)
  })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  return (res.data && res.data[0]) || null
}

async function loadAttempt(openid) {
  const res = await db.collection('pickupAttempts').where({ _id: openid }).get()
  return (res.data && res.data[0]) || { _id: openid, fails: 0, lockedUntil: 0 }
}

async function saveAttempt(openid, fails, lockedUntil) {
  const data = { fails, lockedUntil, updatedAt: db.serverDate() }
  const res = await db.collection('pickupAttempts').where({ _id: openid }).update({ data })
  if (!res.stats || res.stats.updated === 0) {
    await db.collection('pickupAttempts').add({
      data: Object.assign({ _id: openid, createdAt: db.serverDate() }, data)
    })
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(CODES.FORBIDDEN, '无权限')
  try {
    await requireAdmin(db, OPENID)
  } catch (err) {
    return err
  }

  const payload = event || {}
  const order = await loadOrder(payload)

  // 按码查不到订单也要计入错误次数，否则可以无限试码。
  if (!order) {
    if (!payload.orderId && !payload.code) return fail(CODES.PARAM_INVALID, '请提供自提码')
    const attempt = await loadAttempt(OPENID)
    if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
      return fail(CODES.PARAM_INVALID, '错误次数过多，已锁定 5 分钟')
    }
    const info = nextFail(attempt)
    if (info.locked) {
      await saveAttempt(OPENID, 0, Date.now() + LOCK_MS)
    } else {
      await saveAttempt(OPENID, info.fails, attempt.lockedUntil || 0)
    }
    return fail(CODES.PARAM_INVALID, '未找到可核销的自提订单，' + info.message)
  }

  const attempt = await loadAttempt(OPENID)
  const check = assertCanVerify(order, payload.code, attempt)
  if (!check.ok) {
    if (check.locked) {
      await saveAttempt(OPENID, 0, Date.now() + LOCK_MS)
    } else {
      await saveAttempt(OPENID, check.fails || attempt.fails || 0, attempt.lockedUntil || 0)
    }
    return fail(check.code, check.message)
  }

  const upd = await db.collection('orders').where({
    _id: order._id,
    status: ORDER_STATUS.PAID
  }).update({
    data: {
      status: ORDER_STATUS.COMPLETED,
      'pickup.verifiedAt': db.serverDate(),
      completedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  if (!upd.stats || upd.stats.updated !== 1) {
    return fail(CODES.ORDER_STATUS_INVALID, '订单状态已变更，请刷新后重试')
  }

  await saveAttempt(OPENID, 0, 0)
  return ok({ orderId: order._id, status: ORDER_STATUS.COMPLETED })
}
