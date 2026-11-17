const test = require('node:test')
const assert = require('node:assert')
const { validateAddress } = require('../../../miniprogram/utils/address')

const base = {
  name: '张三',
  phone: '13800138000',
  region: ['广东省', '深圳市', '南山区'],
  detail: '科技园1号'
}

test('合法地址通过', () => {
  assert.strictEqual(validateAddress(base).ok, true)
})

test('手机号非法被拒', () => {
  assert.strictEqual(validateAddress(Object.assign({}, base, { phone: '123' })).ok, false)
})

test('姓名超长被拒', () => {
  assert.strictEqual(validateAddress(Object.assign({}, base, { name: 'a'.repeat(21) })).ok, false)
})

test('姓名为空被拒', () => {
  assert.strictEqual(validateAddress(Object.assign({}, base, { name: '   ' })).ok, false)
})

test('详细地址超100字被拒', () => {
  assert.strictEqual(validateAddress(Object.assign({}, base, { detail: 'a'.repeat(101) })).ok, false)
})

test('省市区不足三级被拒', () => {
  assert.strictEqual(validateAddress(Object.assign({}, base, { region: ['广东省', '深圳市'] })).ok, false)
})
