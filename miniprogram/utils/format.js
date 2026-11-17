/** 展示层格式化：金额一律以「分」存储，展示时转「元」。 */

function fenToYuan(fen) {
  return (Number(fen) / 100).toFixed(2)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDateTime(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return (
    d.getFullYear() +
    '-' + pad2(d.getMonth() + 1) +
    '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) +
    ':' + pad2(d.getMinutes())
  )
}

module.exports = { fenToYuan, formatDateTime }
