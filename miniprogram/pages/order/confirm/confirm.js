const { callFn } = require('../../../utils/request')
const cartLib = require('../../../utils/cart')
const { fenToYuan } = require('../../../utils/format')
const { FREIGHT_FREE_THRESHOLD, FREIGHT_FEE } = require('../../../utils/config')

Page({
  data: {
    ready: false,
    items: [],
    deliveryType: 'express',
    address: null,
    addressText: '',
    store: null,
    remark: '',
    goodsAmountText: '0.00',
    freightText: '0.00',
    payAmountText: '0.00',
    submitting: false
  },

  onLoad() {
    this.loadCart()
    this.loadAddress()
    this.loadStore()
  },

  onShow() {
    if (this.data.ready) this.loadAddress()
  },

  loadCart() {
    const cart = cartLib.load().filter((item) => item.checked && !item.invalid)
    const items = cart.map((item) =>
      Object.assign({}, item, {
        priceText: fenToYuan(item.price),
        subtotalText: fenToYuan(item.price * item.count)
      })
    )
    this.setData({ items, ready: true })
    this.calcAmount()
  },

  loadAddress() {
    wx.cloud
      .database()
      .collection('addresses')
      .orderBy('isDefault', 'desc')
      .orderBy('createdAt', 'desc')
      .get()
      .then((res) => {
        const address = (res.data && res.data[0]) || null
        this.setData({
          address,
          addressText: address ? (address.region || []).join(' ') + ' ' + address.detail : ''
        })
      })
      .catch(() => {})
  },

  loadStore() {
    wx.cloud
      .database()
      .collection('stores')
      .where({ isActive: true })
      .limit(1)
      .get()
      .then((res) => {
        this.setData({ store: (res.data && res.data[0]) || null })
      })
      .catch(() => {})
  },

  calcAmount() {
    const goodsAmount = this.data.items.reduce((sum, item) => sum + item.price * item.count, 0)
    let freightAmount = 0
    if (this.data.deliveryType === 'express') {
      freightAmount = goodsAmount >= FREIGHT_FREE_THRESHOLD ? 0 : FREIGHT_FEE
    }
    this.setData({
      goodsAmountText: fenToYuan(goodsAmount),
      freightText: fenToYuan(freightAmount),
      payAmountText: fenToYuan(goodsAmount + freightAmount)
    })
  },

  onSwitchDelivery(e) {
    const type = e.currentTarget.dataset.type
    if (!type || type === this.data.deliveryType) return
    this.setData({ deliveryType: type })
    this.calcAmount()
  },

  onChooseAddress() {
    wx.navigateTo({ url: '/pages/address/list/list' })
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value || '' })
  },

  onSubmit() {
    if (this.data.submitting) return
    const { items, deliveryType, address, store, remark } = this.data
    if (items.length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    if (deliveryType === 'express' && !address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }
    if (deliveryType === 'pickup' && !store) {
      wx.showToast({ title: '暂无可用自提门店', icon: 'none' })
      return
    }

    const payload = {
      items: items.map((item) => ({ goodsId: item.goodsId, count: item.count })),
      deliveryType,
      remark
    }
    if (deliveryType === 'express') {
      payload.receiver = {
        name: address.name,
        phone: address.phone,
        region: (address.region || []).join(' '),
        detail: address.detail
      }
    } else {
      payload.pickup = { storeId: store._id }
    }

    this.setData({ submitting: true })
    callFn('createOrder', payload)
      .then((data) => {
        const orderedIds = payload.items.map((item) => item.goodsId)
        cartLib.save(cartLib.load().filter((item) => orderedIds.indexOf(item.goodsId) === -1))
        return callFn('pay', { orderId: data.orderId }, { loading: false }).then(() => data)
      })
      .then((data) => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/order/detail/detail?id=' + data.orderId })
        }, 800)
      })
      .catch((err) => {
        if (err && err.code === 40002) this.loadCart()
      })
      .finally(() => {
        this.setData({ submitting: false })
      })
  }
})
