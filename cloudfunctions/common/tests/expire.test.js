const test = require('node:test')
const assert = require('node:assert')
const { isExpired } = require('../lib/orderRules')

test('超过15分钟视为过期', () => {
  const now = new Date('2026-11-17T12:00:00+08:00').getTime()
  assert.strictEqual(isExpired(now - 15 * 60000, now, 15), true)
})

test('未满15分钟不过期', () => {
  const now = Date.now()
  assert.strictEqual(isExpired(now - 14 * 60000, now, 15), false)
})
