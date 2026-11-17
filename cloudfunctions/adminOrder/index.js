/**
 * 商家订单管理云函数。
 * 首步鉴权：非 admins 白名单用户一律 40301。
 * action: list | ship | markRefunded
 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { requireAdmin } = require('../common/lib/auth')
const { assertCanShip } = require('../common/lib/pickupRules')
const { ORDER_STATUS } = require('../common/lib/status')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const PAGE_SIZE = 10
const COMPANY_NAMES = {
  SF: '顺丰速运',
  JD: '京东物流',
  ZTO: '中通快递',
  YTO: '圆通速递',
  YUNDA: '韵达快递',
  EMS: 'EMS',
  OTHER: '其他'
}

function buildWhere(tab) {
  if (tab === 'pending_ship') return { status: ORDER_STATUS.PAID, deliveryType: 'express' }
  if (tab === 'pending_pickup') return { status: ORDER_STATUS.PAID, deliveryType: 'pickup' }
  if (tab === 'shipped') return { status: ORDER_STATUS.SHIPPED }
  if (tab === 'completed') return { status: ORDER_STATUS.COMPLETED }
  return {}
}

function summarize(order) {
  const items = order.items || []
  const count = items.reduce((sum, item) => sum + item.count, 0)
  return {
    summary: items.length ? items[0].title + (items.length > 1 ? ' 等 ' + items.length + ' 件商品' : '') : '',
    totalCount: count,
    buyer: String(order.openid || '').slice(-6)
  }
}

async function list(payload) {
  const page = Number.isInteger(payload.page) && payload.page > 0 ? payload.page : 0
  const where = buildWhere(payload.tab)
  const collection = db.collection('orders')
  const query = Object.keys(where).length ? collection.where(where) : collection
  const res = await query
    .orderBy('createdAt', 'desc')
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get()
  const rows = (res.data || []).map((order) => Object.assign({}, order, summarize(order)))
  return ok({ list: rows, hasMore: rows.length === PAGE_SIZE })
}

async function ship(payload) {
  const id = payload.id
  if (typeof id !== 'string' || !id) return fail(CODES.PARAM_INVALID, '参数错误')
  if (!payload.companyCode || !COMPANY_NAMES[payload.companyCode]) {
    return fail(CODES.PARAM_INVALID, '快递公司不合法')
  }
  const trackingNo = String(payload.trackingNo || '').trim()
  if (!trackingNo) return fail(CODES.PARAM_INVALID, '请填写运单号')

  const res = await db.collection('orders').where({ _id: id }).get()
  const order = (res.data && res.data[0]) || null
  const check = assertCanShip(order)
  if (!check.ok) return fail(check.code, check.message)

  const upd = await db.collection('orders').where({
    _id: id,
    status: ORDER_STATUS.PAID,
    deliveryType: 'express'
  }).update({
    data: {
      status: ORDER_STATUS.SHIPPED,
      express: {
        company: COMPANY_NAMES[payload.companyCode],
        companyCode: payload.companyCode,
        trackingNo,
        shippedAt: db.serverDate()
      },
      updatedAt: db.serverDate()
    }
  })
  if (!upd.stats || upd.stats.updated !== 1) {
    return fail(CODES.ORDER_STATUS_INVALID, '订单状态已变更，请刷新后重试')
  }
  return ok({ id, status: ORDER_STATUS.SHIPPED })
}

async function markRefunded(payload) {
  const id = payload.id
  if (typeof id !== 'string' || !id) return fail(CODES.PARAM_INVALID, '参数错误')

  const res = await db.collection('orders').where({ _id: id }).get()
  const order = (res.data && res.data[0]) || null
  if (!order) return fail(CODES.PARAM_INVALID, '订单不存在')

  const upd = await db.collection('orders').where({
    _id: id,
    status: _.in([ORDER_STATUS.PAID, ORDER_STATUS.SHIPPED])
  }).update({
    data: {
      status: ORDER_STATUS.REFUNDED,
      refundedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  if (!upd.stats || upd.stats.updated !== 1) {
    return fail(CODES.ORDER_STATUS_INVALID, '当前状态不可退款')
  }
  return ok({ id, status: ORDER_STATUS.REFUNDED })
}

const ACTIONS = { list, ship, markRefunded }

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(CODES.FORBIDDEN, '无权限')
  try {
    await requireAdmin(db, OPENID)
  } catch (err) {
    return err
  }

  const action = event && event.action
  const handler = ACTIONS[action]
  if (!handler) return fail(CODES.PARAM_INVALID, '不支持的操作')
  return handler(event.payload || {})
}
