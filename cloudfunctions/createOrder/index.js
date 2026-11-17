/**
 * 建单云函数：校验商品与参数 → 服务端算价 → 原子扣库存 → 写订单。
 * 前端传来的任何金额字段一律忽略，价格以数据库当前值为准。
 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const money = require('../common/lib/money')
const { genOrderNo } = require('../common/lib/orderNo')
const { genPickupCode } = require('../common/lib/pickupCode')
const { ORDER_STATUS } = require('../common/lib/status')
const { deductAll, rollbackAll } = require('../common/lib/stock')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MIN_COUNT = 1
const MAX_COUNT = 99
const MAX_REMARK = 100

function failReason(reason) {
  if (reason === 'off_sale' || reason === 'not_found') {
    return fail(CODES.GOODS_UNAVAILABLE, '商品已下架，请刷新后重试')
  }
  return fail(CODES.STOCK_INSUFFICIENT, '库存不足，请刷新后重试')
}

function normalizeItems(items) {
  const merged = []
  const index = {}
  for (const item of items) {
    if (!item || typeof item.goodsId !== 'string' || !item.goodsId) return null
    const count = item.count
    if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) return null
    if (index[item.goodsId] === undefined) {
      index[item.goodsId] = merged.length
      merged.push({ goodsId: item.goodsId, count })
    } else {
      const pos = index[item.goodsId]
      merged[pos].count += count
      if (merged[pos].count > MAX_COUNT) return null
    }
  }
  return merged.length ? merged : null
}

function validateInput(event) {
  if (!event) return '参数错误'
  const items = normalizeItems(Array.isArray(event.items) ? event.items : [])
  if (!items) return '商品参数错误'
  if (event.deliveryType !== 'express' && event.deliveryType !== 'pickup') return '配送方式错误'
  if (event.deliveryType === 'express') {
    const r = event.receiver
    if (!r || !r.name || !r.phone || !r.region || !r.detail) return '请填写完整的收货信息'
  } else {
    if (!event.pickup || !event.pickup.storeId) return '请选择自提门店'
  }
  if (event.remark && String(event.remark).length > MAX_REMARK) return '备注不能超过 100 字'
  return null
}

async function loadFreightCfg() {
  const res = await db.collection('config').where({
    key: _.in(['freightFreeThreshold', 'freightFee'])
  }).get()
  const map = {}
  for (const doc of res.data || []) map[doc.key] = doc.value
  return {
    freeThreshold: map.freightFreeThreshold === undefined ? 5900 : map.freightFreeThreshold,
    fee: map.freightFee === undefined ? 800 : map.freightFee
  }
}

async function loadGoods(ids) {
  const res = await db.collection('goods').where({ _id: _.in(ids) }).get()
  const map = {}
  for (const doc of res.data || []) map[doc._id] = doc
  return map
}

async function loadStore(storeId) {
  const res = await db.collection('stores').where({ _id: storeId }).get()
  return (res.data && res.data[0]) || null
}

async function currentStock(goodsId) {
  const res = await db.collection('goods').where({ _id: goodsId }).get()
  const goods = (res.data && res.data[0]) || null
  return goods ? Number(goods.stock) : 0
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(CODES.FORBIDDEN, '请在小程序内操作')

  const invalid = validateInput(event)
  if (invalid) return fail(CODES.PARAM_INVALID, invalid)

  const items = normalizeItems(event.items)
  const ids = items.map(it => it.goodsId)
  const goodsMap = await loadGoods(ids)
  for (const item of items) {
    const goods = goodsMap[item.goodsId]
    if (!goods || goods.status !== 'on_sale') {
      return fail(CODES.GOODS_UNAVAILABLE, '商品「' + ((goods && goods.title) || '未知商品') + '」已下架')
    }
  }

  const orderItems = items.map(item => {
    const goods = goodsMap[item.goodsId]
    return {
      goodsId: item.goodsId,
      title: goods.title,
      coverUrl: goods.coverUrl || '',
      price: Number(goods.price),
      unit: goods.unit || '',
      count: item.count,
      subtotal: Number(goods.price) * item.count
    }
  })
  const goodsAmount = orderItems.reduce((sum, it) => sum + it.subtotal, 0)
  const freightCfg = await loadFreightCfg()
  const { freightAmount, payAmount } = money.calcPayAmount(goodsAmount, event.deliveryType, freightCfg)

  let store = null
  if (event.deliveryType === 'pickup') {
    store = await loadStore(event.pickup.storeId)
    if (!store) return fail(CODES.PARAM_INVALID, '自提门店不存在')
  }

  const deducted = await deductAll(db, items)
  if (!deducted.ok) {
    const failedId = deducted.failed.goodsId
    if (deducted.failed.reason === 'insufficient') {
      const stock = await currentStock(failedId)
      const goods = goodsMap[failedId]
      return fail(
        CODES.STOCK_INSUFFICIENT,
        '「' + ((goods && goods.title) || '商品') + '」库存不足，仅剩 ' + stock + ' 件'
      )
    }
    return failReason(deducted.failed.reason)
  }

  const orderNo = genOrderNo()
  const pickupCode = event.deliveryType === 'pickup' ? genPickupCode() : ''
  const receiver = event.deliveryType === 'express'
    ? {
        name: String(event.receiver.name),
        phone: String(event.receiver.phone),
        region: String(event.receiver.region),
        detail: String(event.receiver.detail)
      }
    : null
  const pickup = event.deliveryType === 'pickup'
    ? {
        storeId: store._id,
        name: store.name,
        address: store.address,
        phone: store.phone,
        businessHours: store.businessHours || '',
        code: pickupCode
      }
    : null

  let orderId
  try {
    const res = await db.collection('orders').add({
      data: {
        orderNo,
        status: ORDER_STATUS.PENDING_PAY,
        _openid: OPENID,
        openid: OPENID,
        items: orderItems,
        deliveryType: event.deliveryType,
        receiver,
        pickup,
        remark: event.remark ? String(event.remark) : '',
        goodsAmount,
        freightAmount,
        payAmount,
        hiddenByUser: false,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    orderId = res._id
  } catch (err) {
    // 订单没落库就不能留扣减记录，否则库存永久丢失。
    await rollbackAll(db, items)
    return fail(-1, '下单失败，请重试')
  }

  return ok({
    orderId,
    orderNo,
    pickupCode: pickupCode || undefined,
    payAmount
  })
}
