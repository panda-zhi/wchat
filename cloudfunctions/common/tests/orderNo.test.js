const test = require('node:test')
const assert = require('node:assert')
const { genOrderNo } = require('../lib/orderNo')

test('订单号为 yyyyMMdd 加 6 位随机数字', () => {
  const no = genOrderNo(new Date(2026, 10, 17, 10, 0, 0))
  assert.match(no, /^20261117\d{6}$/)
})

test('不同调用生成的订单号不重复', () => {
  const set = new Set()
  for (let i = 0; i < 200; i++) set.add(genOrderNo())
  assert.ok(set.size > 190)
})
