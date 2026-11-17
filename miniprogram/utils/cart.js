/** 购物车纯逻辑：全部函数不直接读写 Storage，也不依赖 wx，便于本地测试。 */

const MAX_COUNT = 99
const MAX_ITEMS = 50
const CART_KEY = 'cart'

function clone(cart) {
  return (cart || []).map((item) => Object.assign({}, item))
}

function normalizeCount(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_COUNT, Math.max(1, n))
}

function addItem(cart, goods, count) {
  const next = clone(cart)
  const addCount = normalizeCount(count)
  const index = next.findIndex((item) => item.goodsId === goods._id)

  if (index >= 0) {
    const current = next[index]
    const merged = Math.min(MAX_COUNT, current.count + addCount)
    if (merged === current.count) {
      return { cart: next, added: false, message: '单个商品最多 ' + MAX_COUNT + ' 件' }
    }
    next[index] = Object.assign({}, current, {
      title: goods.title,
      coverUrl: goods.coverUrl,
      price: goods.price,
      unit: goods.unit,
      count: merged,
      checked: true,
      invalid: false
    })
    return { cart: next, added: true }
  }

  if (next.length >= MAX_ITEMS) {
    return { cart: next, added: false, message: '购物车最多 ' + MAX_ITEMS + ' 种商品' }
  }

  next.push({
    goodsId: goods._id,
    title: goods.title,
    coverUrl: goods.coverUrl,
    price: goods.price,
    unit: goods.unit,
    count: addCount,
    checked: true,
    invalid: false
  })
  return { cart: next, added: true }
}

function updateCount(cart, goodsId, count) {
  const value = normalizeCount(count)
  return clone(cart).map((item) =>
    item.goodsId === goodsId ? Object.assign({}, item, { count: value }) : item
  )
}

function removeItem(cart, goodsId) {
  return clone(cart).filter((item) => item.goodsId !== goodsId)
}

function toggleItem(cart, goodsId, checked) {
  return clone(cart).map((item) =>
    item.goodsId === goodsId ? Object.assign({}, item, { checked: !!checked }) : item
  )
}

function toggleAll(cart, checked) {
  return clone(cart).map((item) => {
    if (item.invalid) {
      return Object.assign({}, item, { checked: false })
    }
    return Object.assign({}, item, { checked: !!checked })
  })
}

function sumAmount(cart) {
  return (cart || []).reduce(
    (acc, item) => {
      if (!item.checked) return acc
      acc.totalFen += item.price * item.count
      acc.count += item.count
      return acc
    },
    { totalFen: 0, count: 0 }
  )
}

function pruneInvalid(cart, goodsList) {
  const map = {}
  ;(goodsList || []).forEach((goods) => {
    map[goods._id] = goods
  })

  const invalid = []
  const next = (cart || []).map((item) => {
    const goods = map[item.goodsId]
    const bad = !goods || goods.status !== 'on_sale' || goods.stock < item.count
    if (bad) invalid.push(item.goodsId)
    return Object.assign({}, item, {
      invalid: bad,
      checked: bad ? false : item.checked
    })
  })

  return { cart: next, invalid }
}

function load() {
  return wx.getStorageSync(CART_KEY) || []
}

function save(cart) {
  wx.setStorageSync(CART_KEY, cart)
}

module.exports = {
  MAX_COUNT,
  MAX_ITEMS,
  addItem,
  updateCount,
  removeItem,
  toggleItem,
  toggleAll,
  sumAmount,
  pruneInvalid,
  load,
  save
}
