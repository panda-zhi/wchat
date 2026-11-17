const test = require('node:test')
const assert = require('node:assert')
const { assertPayable } = require('../lib/payRules')

const order = { openid: 'u1', status: 'pending_pay' }
const cfg = { enableMockPay: true }

test('本人待付款订单可支付', () => {
  assert.strictEqual(assertPayable({ order, cfg, openid: 'u1' }).ok, true)
})

test('他人订单不可支付', () => {
  assert.strictEqual(assertPayable({ order, cfg, openid: 'u2' }).code, 40301)
})

test('已支付订单不可重复支付', () => {
  assert.strictEqual(assertPayable({ order: { ...order, status: 'paid' }, cfg, openid: 'u1' }).code, 40003)
})

test('模拟支付开关关闭时不可支付', () => {
  assert.strictEqual(assertPayable({ order, cfg: { enableMockPay: false }, openid: 'u1' }).code, 40010)
})
