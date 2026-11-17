const { decorateStock } = require('../../../utils/goods')
const { fenToYuan } = require('../../../utils/format')
const cartLib = require('../../../utils/cart')

Page({
  data: {
    id: '',
    goods: null,
    loading: true,
    loadFailed: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' })
    this.fetch()
  },

  onRetry() {
    this.fetch()
  },

  fetch() {
    const id = this.data.id
    if (!id) {
      this.setData({ loading: false, loadFailed: true })
      return
    }
    this.setData({ loading: true, loadFailed: false })
    wx.cloud
      .database()
      .collection('goods')
      .doc(id)
      .get()
      .then((res) => {
        const raw = res.data
        if (!raw) {
          this.setData({ loading: false, loadFailed: true })
          return
        }
        const images = raw.images && raw.images.length ? raw.images : (raw.coverUrl ? [raw.coverUrl] : [])
        const goods = Object.assign({}, raw, { priceText: fenToYuan(raw.price), images }, decorateStock(raw))
        this.setData({ goods, loading: false })
      })
      .catch(() => {
        this.setData({ loading: false, loadFailed: true })
      })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/cart/cart' })
  },

  onAddCart() {
    this.addCart()
  },

  onBuyNow() {
    this.addCart(true)
  },

  addCart(buyNow) {
    const goods = this.data.goods
    if (!goods || !goods.buyable) return

    const result = cartLib.addItem(cartLib.load(), goods, 1)
    if (!result.added) {
      wx.showToast({ title: result.message || '加入购物车失败', icon: 'none' })
      return
    }
    cartLib.save(result.cart)

    if (buyNow) {
      wx.navigateTo({ url: '/pages/cart/cart' })
      return
    }
    wx.showToast({ title: '已加入购物车', icon: 'none' })
  }
})
