/**
 * 库存原子扣减与回滚。db 由调用方注入，本模块不依赖 wx-server-sdk，可直接本地测试。
 */

async function readGoods(db, goodsId) {
  const res = await db.collection('goods').where({ _id: goodsId }).get()
  return (res.data && res.data[0]) || null
}

async function deductOne(db, goodsId, count) {
  const goods = await readGoods(db, goodsId)
  if (!goods) return { ok: false, reason: 'not_found' }
  if (goods.status !== 'on_sale') return { ok: false, reason: 'off_sale' }
  if (Number(goods.stock) < count) return { ok: false, reason: 'insufficient' }

  // 条件更新是并发兜底：只有库存仍足够且仍上架时 updated 才为 1。
  const res = await db.collection('goods').where({
    _id: goodsId,
    status: 'on_sale',
    stock: db.command.gte(count)
  }).update({
    data: {
      stock: db.command.inc(-count),
      sold: db.command.inc(count)
    }
  })
  if (!res.stats || res.stats.updated !== 1) return { ok: false, reason: 'insufficient' }
  return { ok: true }
}

async function deductAll(db, items) {
  const deducted = []
  for (const item of items) {
    const res = await deductOne(db, item.goodsId, item.count)
    if (!res.ok) {
      if (deducted.length) await rollbackAll(db, deducted)
      return { ok: false, failed: { goodsId: item.goodsId, reason: res.reason }, deducted: [] }
    }
    deducted.push({ goodsId: item.goodsId, count: item.count })
  }
  return { ok: true, deducted }
}

async function rollbackAll(db, items) {
  for (const item of items) {
    await db.collection('goods').where({ _id: item.goodsId }).update({
      data: {
        stock: db.command.inc(item.count),
        sold: db.command.inc(-item.count)
      }
    })
  }
}

module.exports = { deductOne, deductAll, rollbackAll }
