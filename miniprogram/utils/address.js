/** 收货地址表单校验（纯函数）。 */

const NAME_MAX = 20
const DETAIL_MAX = 100
const PHONE_RE = /^1[3-9]\d{9}$/

function validateAddress(address) {
  const a = address || {}
  const name = (a.name || '').trim()
  const phone = (a.phone || '').trim()
  const region = a.region || []
  const detail = (a.detail || '').trim()

  if (!name) return { ok: false, message: '请填写收货人姓名' }
  if (name.length > NAME_MAX) return { ok: false, message: '姓名最多 ' + NAME_MAX + ' 个字' }
  if (!PHONE_RE.test(phone)) return { ok: false, message: '请填写正确的手机号' }
  if (!Array.isArray(region) || region.length !== 3) {
    return { ok: false, message: '请选择省市区' }
  }
  if (!detail) return { ok: false, message: '请填写详细地址' }
  if (detail.length > DETAIL_MAX) {
    return { ok: false, message: '详细地址最多 ' + DETAIL_MAX + ' 个字' }
  }
  return { ok: true }
}

module.exports = { validateAddress }
