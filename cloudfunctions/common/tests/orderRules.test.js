const test = require('node:test')
const assert = require('node:assert')
const { canCancel, canConfirm } = require('../lib/orderRules')

test('待付款可取消', () => {
  assert.strictEqual(canCancel({ status: 'pending_pay' }).ok, true)
})

test('已支付不可自助取消', () => {
  assert.strictEqual(canCancel({ status: 'paid' }).code, 40303)
})

test('仅已发货快递单可确认收货', () => {
  assert.strictEqual(canConfirm({ status: 'shipped', deliveryType: 'express' }).ok, true)
  assert.strictEqual(canConfirm({ status: 'paid', deliveryType: 'express' }).ok, false)
  assert.strictEqual(canConfirm({ status: 'shipped', deliveryType: 'pickup' }).ok, false)
})
