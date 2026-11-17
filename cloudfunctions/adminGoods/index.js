/**
 * 商家商品管理云函数。
 * 首步鉴权：非 admins 白名单用户一律 40301，前端隐藏入口不作为安全边界。
 * action: create | update | toggleStatus | setStock | remove
 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { requireAdmin } = require('../common/lib/auth')
const { validateGoods } = require('../common/lib/goodsRules')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const EDITABLE_FIELDS = ['title', 'unit', 'price', 'stock', 'category', 'coverUrl', 'images', 'description', 'sort']
const DEFAULT_SORT = 999

function pick(payload, fields) {
  const out = {}
  for (const key of fields) {
    if (payload[key] !== undefined) out[key] = payload[key]
  }
  return out
}

function normalizeImages(images, coverUrl) {
  const list = Array.isArray(images) ? images.filter((url) => typeof url === 'string' && url) : []
  if (!list.length && coverUrl) return [coverUrl]
  return list
}

async function getGoods(id) {
  const res = await db.collection('goods').where({ _id: id }).get()
  return (res.data && res.data[0]) || null
}

async function create(payload) {
  const check = validateGoods(payload)
  if (!check.ok) return fail(CODES.PARAM_INVALID, check.message)
  const res = await db.collection('goods').add({
    data: {
      title: String(payload.title).trim(),
      unit: String(payload.unit).trim(),
      price: payload.price,
      stock: payload.stock,
      category: payload.category,
      coverUrl: payload.coverUrl,
      images: normalizeImages(payload.images, payload.coverUrl),
      description: payload.description ? String(payload.description) : '',
      status: 'on_sale',
      sold: 0,
      specs: [],
      sort: Number.isInteger(payload.sort) ? payload.sort : DEFAULT_SORT,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  return ok({ id: res._id })
}

async function update(payload) {
  if (!payload || typeof payload.id !== 'string' || !payload.id) {
    return fail(CODES.PARAM_INVALID, '参数错误')
  }
  const goods = await getGoods(payload.id)
  if (!goods) return fail(CODES.PARAM_INVALID, '商品不存在')

  const merged = Object.assign({}, goods, pick(payload, EDITABLE_FIELDS))
  const check = validateGoods(merged)
  if (!check.ok) return fail(CODES.PARAM_INVALID, check.message)

  const data = pick(payload, EDITABLE_FIELDS)
  if (data.title !== undefined) data.title = String(data.title).trim()
  if (data.unit !== undefined) data.unit = String(data.unit).trim()
  if (data.coverUrl !== undefined) data.coverUrl = data.coverUrl
  if (data.images !== undefined) data.images = normalizeImages(data.images, merged.coverUrl)
  data.updatedAt = db.serverDate()

  await db.collection('goods').doc(payload.id).update({ data })
  return ok({ id: payload.id })
}

async function toggleStatus(payload) {
  if (!payload || typeof payload.id !== 'string' || !payload.id) {
    return fail(CODES.PARAM_INVALID, '参数错误')
  }
  if (payload.status !== 'on_sale' && payload.status !== 'off_sale') {
    return fail(CODES.PARAM_INVALID, '状态不合法')
  }
  const goods = await getGoods(payload.id)
  if (!goods) return fail(CODES.PARAM_INVALID, '商品不存在')
  await db.collection('goods').doc(payload.id).update({
    data: { status: payload.status, updatedAt: db.serverDate() }
  })
  return ok({ id: payload.id, status: payload.status })
}

async function setStock(payload) {
  if (!payload || typeof payload.id !== 'string' || !payload.id) {
    return fail(CODES.PARAM_INVALID, '参数错误')
  }
  if (!Number.isInteger(payload.stock) || payload.stock < 0) {
    return fail(CODES.PARAM_INVALID, '库存必须为不小于 0 的整数')
  }
  const goods = await getGoods(payload.id)
  if (!goods) return fail(CODES.PARAM_INVALID, '商品不存在')
  await db.collection('goods').doc(payload.id).update({
    data: { stock: payload.stock, updatedAt: db.serverDate() }
  })
  return ok({ id: payload.id, stock: payload.stock })
}

async function remove(payload) {
  if (!payload || typeof payload.id !== 'string' || !payload.id) {
    return fail(CODES.PARAM_INVALID, '参数错误')
  }
  const goods = await getGoods(payload.id)
  if (!goods) return fail(CODES.PARAM_INVALID, '商品不存在')

  const used = await db.collection('orders').where({ 'items.goodsId': payload.id }).count()
  if (used && used.total > 0) {
    return fail(CODES.PARAM_INVALID, '该商品已有订单，请改为下架')
  }

  await db.collection('goods').doc(payload.id).remove()

  const fileList = [goods.coverUrl]
    .concat(Array.isArray(goods.images) ? goods.images : [])
    .filter((url) => typeof url === 'string' && url.indexOf('cloud://') === 0)
  if (fileList.length) {
    try {
      await cloud.deleteFile({ fileList })
    } catch (err) {
      // 图片删除失败不影响商品删除结果。
    }
  }
  return ok({ id: payload.id })
}

const ACTIONS = { create, update, toggleStatus, setStock, remove }

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
