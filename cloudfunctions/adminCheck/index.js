/** 返回当前 openid 是否管理员，供「我的」页条件渲染商家入口。前端隐藏不作为安全边界。 */
const cloud = require('wx-server-sdk')
const { ok, fail, CODES } = require('../common/lib/errors')
const { isAdmin } = require('../common/lib/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(CODES.FORBIDDEN, '请在小程序内操作')
  const pass = await isAdmin(db, OPENID)
  return ok({ isAdmin: pass, openid: OPENID })
}
