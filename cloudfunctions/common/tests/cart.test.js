const test = require('node:test')
const assert = require('node:assert')
const cart = require('../../../miniprogram/utils/cart')

const g = (id, price, stock) => ({
  _id: id,
  title: '苹果' + id,
  price,
  stock,
  status: 'on_sale',
  unit: '500g'
})

test('同商品重复加购累加数量', () => {
  let c = cart.addItem([], g('a', 1000, 10), 1).cart
  c = cart.addItem(c, g('a', 1000, 10), 2).cart
  assert.strictEqual(c[0].count, 3)
  assert.strictEqual(c.length, 1)
})

test('单商品数量上限99', () => {
  const r = cart.addItem([], g('a', 1000, 999), 120)
  assert.strictEqual(r.cart[0].count, 99)
})

test('条目上限50', () => {
  let c = []
  for (let i = 0; i < 50; i++) {
    c = cart.addItem(c, g('id' + i, 100, 10), 1).cart
  }
  const r = cart.addItem(c, g('id50', 100, 10), 1)
  assert.strictEqual(r.added, false)
  assert.strictEqual(r.cart.length, 50)
})

test('合计只统计勾选项', () => {
  let c = cart.addItem([], g('a', 1000, 10), 2).cart
  c = cart.addItem(c, g('b', 500, 10), 3).cart
  c = cart.toggleItem(c, 'b', false)
  assert.deepStrictEqual(cart.sumAmount(c), { totalFen: 2000, count: 2 })
})

test('updateCount 收敛到 1-99', () => {
  const c = cart.addItem([], g('a', 1000, 10), 2).cart
  assert.strictEqual(cart.updateCount(c, 'a', 0)[0].count, 1)
  assert.strictEqual(cart.updateCount(c, 'a', 200)[0].count, 99)
})

test('removeItem 删除指定条目', () => {
  let c = cart.addItem([], g('a', 1000, 10), 1).cart
  c = cart.addItem(c, g('b', 1000, 10), 1).cart
  assert.deepStrictEqual(cart.removeItem(c, 'a').map((i) => i.goodsId), ['b'])
})

test('toggleAll 统一勾选状态', () => {
  let c = cart.addItem([], g('a', 1000, 10), 1).cart
  c = cart.addItem(c, g('b', 1000, 10), 1).cart
  assert.deepStrictEqual(cart.toggleAll(c, false).map((i) => i.checked), [false, false])
})

test('下架商品被标记失效并取消勾选', () => {
  const c = cart.addItem([], g('a', 1000, 10), 2).cart
  const r = cart.pruneInvalid(c, [{ _id: 'a', status: 'off_sale', stock: 0 }])
  assert.deepStrictEqual(r.invalid, ['a'])
  assert.strictEqual(r.cart[0].invalid, true)
  assert.strictEqual(r.cart[0].checked, false)
})

test('库存不足或商品缺失同样标记失效', () => {
  let c = cart.addItem([], g('a', 1000, 10), 5).cart
  c = cart.addItem(c, g('b', 1000, 10), 1).cart
  const r = cart.pruneInvalid(c, [{ _id: 'a', status: 'on_sale', stock: 4 }])
  assert.deepStrictEqual(r.invalid, ['a', 'b'])
})

test('有效商品保持勾选并清除失效标记', () => {
  const c = cart.addItem([], g('a', 1000, 10), 2).cart
  const r = cart.pruneInvalid(c, [{ _id: 'a', status: 'on_sale', stock: 10 }])
  assert.deepStrictEqual(r.invalid, [])
  assert.strictEqual(r.cart[0].checked, true)
  assert.strictEqual(r.cart[0].invalid, false)
})
