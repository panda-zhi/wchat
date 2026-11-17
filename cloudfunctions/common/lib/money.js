/** 金额工具：一律以整数分计算，展示时才转元。 */

function yuanToFen(v) {
  return Math.round(Number(v) * 100)
}

function fenToYuan(fen) {
  return (Number(fen) / 100).toFixed(2)
}

const DEFAULT_FREIGHT = { freeThreshold: 5900, fee: 800 }

function calcFreight(goodsAmount, deliveryType, cfg) {
  if (deliveryType === 'pickup') return 0
  const source = cfg || DEFAULT_FREIGHT
  const freeThreshold = Number(source.freeThreshold)
  const fee = Number(source.fee)
  const threshold = Number.isFinite(freeThreshold) ? freeThreshold : DEFAULT_FREIGHT.freeThreshold
  const freightFee = Number.isFinite(fee) ? fee : DEFAULT_FREIGHT.fee
  return goodsAmount >= threshold ? 0 : freightFee
}

function calcPayAmount(goodsAmount, deliveryType, cfg) {
  const freightAmount = calcFreight(goodsAmount, deliveryType, cfg)
  return { goodsAmount, freightAmount, payAmount: goodsAmount + freightAmount }
}

module.exports = { yuanToFen, fenToYuan, calcFreight, calcPayAmount }
