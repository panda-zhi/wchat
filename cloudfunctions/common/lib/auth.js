/** 管理员鉴权：db 由调用方注入，本模块不依赖 wx-server-sdk。 */

const { CODES, fail } = require('./errors')

/** 查 admins 白名单，openid 在名单内即为管理员。 */
async function isAdmin(db, openid) {
  if (!openid) return false
  const res = await db.collection('admins').where({ openid }).count()
  return (res && res.total) > 0
}

/**
 * 非管理员时抛出业务失败对象（含 code/message），由云函数 catch 后直接返回。
 * 抛出的对象形状与 errors.fail 的返回值一致，前端可原样消费。
 */
async function requireAdmin(db, openid) {
  const pass = await isAdmin(db, openid)
  if (!pass) throw fail(CODES.FORBIDDEN, '无权限')
  return true
}

module.exports = { isAdmin, requireAdmin }
