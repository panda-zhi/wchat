const test = require('node:test')
const assert = require('node:assert')
const { ORDER_STATUS, canTransit } = require('../lib/status')

test('允许的状态流转', () => {
  assert.strictEqual(canTransit(ORDER_STATUS.PENDING_PAY, ORDER_STATUS.PAID), true)
  assert.strictEqual(canTransit(ORDER_STATUS.PAID, ORDER_STATUS.SHIPPED), true)
  assert.strictEqual(canTransit(ORDER_STATUS.SHIPPED, ORDER_STATUS.COMPLETED), true)
  assert.strictEqual(canTransit(ORDER_STATUS.PENDING_PAY, ORDER_STATUS.CANCELLED), true)
})

test('禁止跳过或倒退的状态流转', () => {
  assert.strictEqual(canTransit(ORDER_STATUS.PENDING_PAY, ORDER_STATUS.SHIPPED), false)
  assert.strictEqual(canTransit(ORDER_STATUS.COMPLETED, ORDER_STATUS.PAID), false)
  assert.strictEqual(canTransit(ORDER_STATUS.CANCELLED, ORDER_STATUS.PAID), false)
})
