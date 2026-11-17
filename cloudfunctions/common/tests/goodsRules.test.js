const test = require('node:test')
const assert = require('node:assert')
const { validateGoods } = require('../lib/goodsRules')

const base = {
  title: '红富士苹果',
  unit: '500g',
  price: 1990,
  stock: 10,
  category: 'seasonal',
  coverUrl: 'cloud://x/a.jpg'
}

test('合法商品通过', () => assert.strictEqual(validateGoods(base).ok, true))
test('售价为0被拒', () => assert.strictEqual(validateGoods(Object.assign({}, base, { price: 0 })).ok, false))
test('库存为负被拒', () => assert.strictEqual(validateGoods(Object.assign({}, base, { stock: -1 })).ok, false))
test('标题超30字被拒', () => assert.strictEqual(validateGoods(Object.assign({}, base, { title: 'a'.repeat(31) })).ok, false))
test('缺少封面被拒', () => assert.strictEqual(validateGoods(Object.assign({}, base, { coverUrl: '' })).ok, false))
