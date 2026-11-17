/** 商品库存/状态展示逻辑（纯函数，供页面与测试共用）。 */

const LOW_STOCK_THRESHOLD = 5

function decorateStock(goods) {
  const status = goods && goods.status
  const stock = Number(goods && goods.stock) || 0

  if (status && status !== 'on_sale') {
    return { soldOut: true, stockText: '已下架', buyable: false }
  }
  if (stock <= 0) {
    return { soldOut: true, stockText: '已售罄', buyable: false }
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return { soldOut: false, stockText: '仅剩' + stock + '件', buyable: true }
  }
  return { soldOut: false, stockText: '有货', buyable: true }
}

module.exports = { decorateStock }
