const test = require('node:test')
const assert = require('node:assert')
const { isAdmin } = require('../lib/auth')

const dbWith = n => ({ collection: () => ({ where: () => ({ count: async () => ({ total: n }) }) }) })

test('白名单内返回true', async () => assert.strictEqual(await isAdmin(dbWith(1), 'o1'), true))
test('白名单外返回false', async () => assert.strictEqual(await isAdmin(dbWith(0), 'o2'), false))
