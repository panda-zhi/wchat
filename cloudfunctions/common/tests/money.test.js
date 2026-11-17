const test = require('node:test')
const assert = require('node:assert')
const money = require('../lib/money')

test('yuanToFen 处理小数与字符串', () => {
  assert.strictEqual(money.yuanToFen('59.9'), 5990)
  assert.strictEqual(money.yuanToFen(0.1 + 0.2), 30)
})

test('fenToYuan 固定两位小数', () => {
  assert.strictEqual(money.fenToYuan(5990), '59.90')
  assert.strictEqual(money.fenToYuan(0), '0.00')
})

test('运费：满5900免运费，否则800，自提恒0', () => {
  const cfg = { freeThreshold: 5900, fee: 800 }
  assert.strictEqual(money.calcFreight(5800, 'express', cfg), 800)
  assert.strictEqual(money.calcFreight(5900, 'express', cfg), 0)
  assert.strictEqual(money.calcFreight(100, 'pickup', cfg), 0)
})

test('calcPayAmount 金额合计正确', () => {
  const r = money.calcPayAmount(5800, 'express', { freeThreshold: 5900, fee: 800 })
  assert.deepStrictEqual(r, { goodsAmount: 5800, freightAmount: 800, payAmount: 6600 })
})
