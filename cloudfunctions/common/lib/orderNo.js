/** 订单号：yyyyMMdd + 6 位随机数字。 */

function pad2(n) {
  return String(n).padStart(2, '0')
}

function genOrderNo(now) {
  const d = now || new Date()
  const datePart = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const randomPart = String(Math.floor(100000 + Math.random() * 900000))
  return datePart + randomPart
}

module.exports = { genOrderNo }
