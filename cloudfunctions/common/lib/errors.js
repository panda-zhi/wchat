/** 统一错误码与响应构造。 */

const CODES = {
  GOODS_UNAVAILABLE: 40001,
  STOCK_INSUFFICIENT: 40002,
  ORDER_STATUS_INVALID: 40003,
  PARAM_INVALID: 40004,
  PAY_NOT_OPEN: 40010,
  FORBIDDEN: 40301,
  CANNOT_CANCEL: 40303
}

function ok(data) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, code, message }
}

module.exports = { CODES, ok, fail }
