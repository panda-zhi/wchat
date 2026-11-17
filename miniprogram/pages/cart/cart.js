const cartLib = require('../../utils/cart')
const { fenToYuan } = require('../../utils/format')

Page({
  data: {
    items: [],
    totalText: '0.00',
    checkedCount: 0,
    allChecked: false,
    invalidCount: 0,
    loaded: false
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const cart = cartLib.load()
    if (cart.length === 0) {
      this.render([])
      return
    }

    const _ = wx.cloud.database().command
    wx.cloud
      .database()
      .collection('goods')
      .where({ _id: _.in(cart.map((item) => item.goodsId)) })
      .get()
      .then((res) => {
        const { cart: next, invalid } = cartLib.pruneInvalid(cart, res.data || [])
        this.setData({ invalidCount: invalid.length })
        this.render(next)
      })
      .catch(() => {
        this.render(cart)
      })
  },

  render(cart) {
    const items = cart.map((item) => Object.assign({}, item, { priceText: fenToYuan(item.price) }))
    const { totalFen, count } = cartLib.sumAmount(cart)
    this.setData({
      items,
      totalText: fenToYuan(totalFen),
      checkedCount: count,
      allChecked: items.length > 0 && items.every((item) => item.checked),
      loaded: true
    })
    cartLib.save(cart)
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((row) => row.goodsId === id)
    if (!item || item.invalid) return
    this.render(cartLib.toggleItem(cartLib.load(), id, !item.checked))
  },

  onToggleAll() {
    this.render(cartLib.toggleAll(cartLib.load(), !this.data.allChecked))
  },

  onStep(e) {
    const id = e.currentTarget.dataset.id
    const delta = Number(e.currentTarget.dataset.delta)
    const item = this.data.items.find((row) => row.goodsId === id)
    if (!item || item.invalid) return
    this.render(cartLib.updateCount(cartLib.load(), id, item.count + delta))
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find((row) => row.goodsId === id)
    if (!item) return
    wx.showModal({
      title: '删除商品',
      content: '确定从购物车删除「' + item.title + '」？',
      success: (res) => {
        if (!res.confirm) return
        this.render(cartLib.removeItem(cartLib.load(), id))
      }
    })
  },

  onCheckout() {
    if (this.data.checkedCount === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    if (this.data.invalidCount > 0) {
      wx.showToast({ title: '已剔除失效商品', icon: 'none' })
    }
    wx.navigateTo({ url: '/pages/order/confirm/confirm' })
  },

  goShopping() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
