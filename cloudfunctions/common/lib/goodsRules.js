/** 商品字段校验（纯函数）：商家新增/编辑商品时统一走这里。 */

const CATEGORIES = ['seasonal', 'imported', 'cut', 'gift']
const MAX_TITLE = 30

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function validateGoods(goods) {
  if (!goods) return { ok: false, message: '商品信息为空' }
  if (!isNonEmptyString(goods.title)) return { ok: false, message: '请填写商品名称' }
  if (goods.title.trim().length > MAX_TITLE) return { ok: false, message: '商品名称不能超过 30 字' }
  if (!isNonEmptyString(goods.unit)) return { ok: false, message: '请填写规格单位' }
  if (!Number.isInteger(goods.price) || goods.price <= 0) {
    return { ok: false, message: '售价必须为大于 0 的整数分' }
  }
  if (!Number.isInteger(goods.stock) || goods.stock < 0) {
    return { ok: false, message: '库存必须为不小于 0 的整数' }
  }
  if (CATEGORIES.indexOf(goods.category) === -1) return { ok: false, message: '分类不合法' }
  if (!isNonEmptyString(goods.coverUrl)) return { ok: false, message: '请上传商品封面' }
  return { ok: true }
}

module.exports = { CATEGORIES, validateGoods }
