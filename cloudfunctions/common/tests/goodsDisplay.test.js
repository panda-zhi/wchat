const test = require('node:test')
const assert = require('node:assert')
const { decorateStock } = require('../../../miniprogram/utils/goods')

test('库存为0显示已售罄且不可购买', () => {
  assert.deepStrictEqual(decorateStock({ stock: 0, status: 'on_sale' }), {
    soldOut: true,
    stockText: '已售罄',
    buyable: false
  })
})

test('库存1-5显示仅剩N件', () => {
  assert.strictEqual(decorateStock({ stock: 3, status: 'on_sale' }).stockText, '仅剩3件')
})

test('库存大于5显示有货', () => {
  assert.strictEqual(decorateStock({ stock: 6, status: 'on_sale' }).stockText, '有货')
})

test('下架商品不可购买', () => {
  assert.strictEqual(decorateStock({ stock: 99, status: 'off_sale' }).buyable, false)
})
