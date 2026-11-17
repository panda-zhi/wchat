const test = require('node:test')
const assert = require('node:assert')
const { genPickupCode, isValidPickupCode } = require('../lib/pickupCode')

test('自提码为4位且不以0开头', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(genPickupCode(), /^[1-9]\d{3}$/)
  }
})

test('自提码格式校验', () => {
  assert.strictEqual(isValidPickupCode('1234'), true)
  assert.strictEqual(isValidPickupCode('0123'), false)
  assert.strictEqual(isValidPickupCode('123'), false)
  assert.strictEqual(isValidPickupCode('abcd'), false)
})
