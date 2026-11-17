const test = require('node:test')
const assert = require('node:assert')
const { deductOne, deductAll, rollbackAll } = require('../lib/stock')

// fakeDb 契约：
// command.inc(n)/gte(n) 返回标记对象；where({_id}).get() 读单条；
// where({_id, status, stock:{...}}).update() 返回 { stats:{updated} }。
function makeDb(goodsMap) {
  const calls = []
  const db = {
    command: {
      inc: n => ({ $inc: n }),
      gte: n => ({ $gte: n })
    },
    collection: () => ({
      where: q => ({
        get: async () => {
          const goods = goodsMap[q._id]
          return { data: goods ? [Object.assign({ _id: q._id }, goods)] : [] }
        },
        update: async ({ data }) => {
          const goods = goodsMap[q._id]
          calls.push({ id: q._id, inc: data.stock.$inc })
          if (!goods) return { stats: { updated: 0 } }
          const need = -data.stock.$inc
          if (q.status && goods.status !== q.status) return { stats: { updated: 0 } }
          if (need > 0 && goods.stock < need) return { stats: { updated: 0 } }
          goods.stock += data.stock.$inc
          goods.sold = (goods.sold || 0) + ((data.sold && data.sold.$inc) || 0)
          return { stats: { updated: 1 } }
        }
      })
    }),
    __calls: calls
  }
  return db
}

test('库存充足时扣减成功', async () => {
  const goodsMap = { a: { stock: 10, sold: 0, status: 'on_sale' } }
  const db = makeDb(goodsMap)

  const res = await deductOne(db, 'a', 2)

  assert.deepStrictEqual(res, { ok: true })
  assert.strictEqual(goodsMap.a.stock, 8)
  assert.strictEqual(goodsMap.a.sold, 2)
})

test('库存不足时扣减失败且库存不变', async () => {
  const goodsMap = { a: { stock: 10, sold: 0, status: 'on_sale' } }
  const db = makeDb(goodsMap)

  const res = await deductOne(db, 'a', 20)

  assert.deepStrictEqual(res, { ok: false, reason: 'insufficient' })
  assert.strictEqual(goodsMap.a.stock, 10)
})

test('商品不存在返回 not_found，已下架返回 off_sale', async () => {
  const goodsMap = { off: { stock: 10, sold: 0, status: 'off_sale' } }
  const db = makeDb(goodsMap)

  assert.deepStrictEqual(await deductOne(db, 'none', 1), { ok: false, reason: 'not_found' })
  assert.deepStrictEqual(await deductOne(db, 'off', 1), { ok: false, reason: 'off_sale' })
})

test('批量扣减中途失败时回滚已扣商品', async () => {
  const goodsMap = {
    a: { stock: 10, sold: 0, status: 'on_sale' },
    b: { stock: 5, sold: 0, status: 'on_sale' }
  }
  const db = makeDb(goodsMap)

  const res = await deductAll(db, [{ goodsId: 'a', count: 2 }, { goodsId: 'b', count: 99 }])

  assert.strictEqual(res.ok, false)
  assert.strictEqual(res.failed.goodsId, 'b')
  assert.strictEqual(res.failed.reason, 'insufficient')
  assert.deepStrictEqual(res.deducted, [])
  assert.strictEqual(goodsMap.a.stock, 10)
  assert.strictEqual(goodsMap.a.sold, 0)
})

test('rollbackAll 把已扣库存与销量还原', async () => {
  const goodsMap = {
    a: { stock: 8, sold: 2, status: 'on_sale' },
    b: { stock: 3, sold: 1, status: 'on_sale' }
  }
  const db = makeDb(goodsMap)

  await rollbackAll(db, [{ goodsId: 'a', count: 2 }, { goodsId: 'b', count: 1 }])

  assert.strictEqual(goodsMap.a.stock, 10)
  assert.strictEqual(goodsMap.a.sold, 0)
  assert.strictEqual(goodsMap.b.stock, 4)
  assert.strictEqual(goodsMap.b.sold, 0)
})
