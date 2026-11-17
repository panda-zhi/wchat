const test = require('node:test')
const assert = require('node:assert')
const { assertCanShip, assertCanVerify } = require('../lib/pickupRules')

const expressPaid = { deliveryType: 'express', status: 'paid' }
const pickupPaid = { deliveryType: 'pickup', status: 'paid', pickup: { code: '1234' } }

test('已支付快递单可发货', () => assert.strictEqual(assertCanShip(expressPaid).ok, true))
test('自提单不可发货', () => assert.strictEqual(assertCanShip(pickupPaid).code, 40003))
test('未支付不可发货', () => assert.strictEqual(assertCanShip(Object.assign({}, expressPaid, { status: 'pending_pay' })).code, 40003))
test('自提码正确可核销', () => assert.strictEqual(assertCanVerify(pickupPaid, '1234', { fails: 0 }).ok, true))
test('自提码错误返回剩余次数', () => {
  const r = assertCanVerify(pickupPaid, '9999', { fails: 0 })
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.remaining, 2)
})
test('锁定期间不可核销', () => {
  const r = assertCanVerify(pickupPaid, '1234', { fails: 3, lockedUntil: Date.now() + 60000 })
  assert.strictEqual(r.ok, false)
})
