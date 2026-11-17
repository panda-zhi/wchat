/**
 * 定时任务：关闭超时未支付订单并回滚库存。
 * 触发频率每分钟一次（config.json），单次最多扫 10 页 × 100 条，避免长时间占用。
 */
const cloud = require('wx-server-sdk')
const { ok, fail } = require('../common/lib/errors')
const { ORDER_STATUS } = require('../common/lib/status')
const { rollbackAll } = require('../common/lib/stock')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const PAGE_SIZE = 100
const MAX_PAGES = 10
const DEFAULT_TIMEOUT_MINUTES = 15

async function readTimeoutMinutes() {
  const res = await db.collection('config').where({ key: 'orderTimeoutMinutes' }).get()
  const doc = (res.data && res.data[0]) || null
  const value = doc ? Number(doc.value) : NaN
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MINUTES
}

exports.main = async () => {
  try {
    const minutes = await readTimeoutMinutes()
    const deadline = new Date(Date.now() - minutes * 60000)
    let closed = 0

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const res = await db.collection('orders').where({
        status: ORDER_STATUS.PENDING_PAY,
        createdAt: _.lt(deadline)
      }).limit(PAGE_SIZE).get()
      const orders = res.data || []
      if (orders.length === 0) break

      for (const order of orders) {
        const upd = await db.collection('orders').where({
          _id: order._id,
          status: ORDER_STATUS.PENDING_PAY
        }).update({
          data: {
            status: ORDER_STATUS.CANCELLED,
            cancelReason: '支付超时自动关闭',
            closedAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
        // 只有真正把状态改成 cancelled 的那一次才回滚库存，保证幂等。
        if (upd.stats && upd.stats.updated === 1) {
          await rollbackAll(db, order.items || [])
          closed += 1
        }
      }

      if (orders.length < PAGE_SIZE) break
    }

    return ok({ closed })
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    return fail(-1, '关单失败：' + message)
  }
}
