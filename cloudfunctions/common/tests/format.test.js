const test = require('node:test')
const assert = require('node:assert')
const { fenToYuan, formatDateTime } = require('../../../miniprogram/utils/format')

test('fenToYuan 固定两位小数', () => {
  assert.strictEqual(fenToYuan(5990), '59.90')
  assert.strictEqual(fenToYuan(0), '0.00')
  assert.strictEqual(fenToYuan(805), '8.05')
})

test('formatDateTime 输出 YYYY-MM-DD HH:mm', () => {
  assert.strictEqual(formatDateTime(new Date(2026, 10, 17, 9, 5)), '2026-11-17 09:05')
  assert.strictEqual(formatDateTime(null), '')
})
