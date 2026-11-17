/**
 * 一次性数据库初始化云函数：建集合、写默认配置与默认门店，可重复执行。
 * 执行成功后必须立即在云开发控制台删除本云函数（无鉴权的初始化脚本不允许长期在线）。
 */
const cloud = require('wx-server-sdk')
const { ok, fail } = require('../common/lib/errors')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'goods',
  'orders',
  'addresses',
  'admins',
  'stores',
  'config',
  'pickupAttempts'
]

const CONFIG_ITEMS = [
  { key: 'freightFreeThreshold', value: 5900 },
  { key: 'freightFee', value: 800 },
  { key: 'enableMockPay', value: false },
  { key: 'orderTimeoutMinutes', value: 15 }
]

const DEFAULT_STORE = {
  name: '鲜果铺（示例店）',
  address: '请填写门店地址',
  phone: '请填写',
  businessHours: '09:00-21:00',
  isActive: true
}

// 集合已存在时 createCollection 抛出的错误码（DATABASE_COLLECTION_ALREADY_EXIST）
const COLLECTION_EXISTS = -501001

async function ensureCollections() {
  const created = []
  const skipped = []
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (err) {
      const code = err && (err.errCode !== undefined ? err.errCode : err.code)
      if (code === COLLECTION_EXISTS) {
        skipped.push(name)
        continue
      }
      throw err
    }
  }
  return { created, skipped }
}

async function ensureConfig() {
  for (const item of CONFIG_ITEMS) {
    const res = await db.collection('config').where({ key: item.key }).count()
    if (res.total === 0) {
      await db.collection('config').add({ data: { key: item.key, value: item.value } })
    }
  }
}

async function ensureStore() {
  const res = await db.collection('stores').count()
  if (res.total === 0) {
    await db.collection('stores').add({ data: DEFAULT_STORE })
  }
}

exports.main = async () => {
  try {
    const { created, skipped } = await ensureCollections()
    await ensureConfig()
    await ensureStore()
    return ok({ created, skipped })
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    return fail(-1, '初始化失败：' + message)
  }
}
