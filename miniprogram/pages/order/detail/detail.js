const { callFn } = require('../../../utils/request')
const { fenToYuan, formatDateTime } = require('../../../utils/format')

Page({
  data: {
    id: '',
    order: null,
    items: [],
    timeline: [],
    loading: true,
    notFound: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' })
    this.fetch()
  },

  onShow() {
    if (this.data.order) this.fetch()
  },

  fetch() {
    const id = this.data.id
    if (!id) {
      this.setData({ loading: false, notFound: true })
      return
    }
    wx.cloud
      .database()
      .collection('orders')
      .doc(id)
      .get()
      .then((res) => {
        const order = res.data
        if (!order) {
          this.setData({ loading: false, notFound: true })
          return
        }
        this.render(order)
      })
      .catch(() => {
        this.setData({ loading: false, notFound: true })
      })
  },

  render(order) {
    const items = (order.items || []).map((item) =>
      Object.assign({}, item, {
        priceText: fenToYuan(item.price),
        subtotalText: fenToYuan(item.subtotal)
      })
    )

    const timeline = [{ label: '提交订单', time: formatDateTime(order.createdAt) }]
    if (order.paidAt) timeline.push({ label: '支付成功', time: formatDateTime(order.paidAt) })
    if (order.express && order.express.shippedAt) {
      timeline.push({ label: '商家发货', time: formatDateTime(order.express.shippedAt) })
    }
    if (order.pickup && order.pickup.verifiedAt) {
      timeline.push({ label: '自提完成', time: formatDateTime(order.pickup.verifiedAt) })
    }
    if (order.completedAt) timeline.push({ label: '交易完成', time: formatDateTime(order.completedAt) })
    if (order.closedAt) timeline.push({ label: '订单关闭', time: formatDateTime(order.closedAt) })

    this.setData({
      order: Object.assign({}, order, {
        createdText: formatDateTime(order.createdAt),
        goodsAmountText: fenToYuan(order.goodsAmount || 0),
        freightAmountText: fenToYuan(order.freightAmount || 0),
        payAmountText: fenToYuan(order.payAmount || 0)
      }),
      items,
      timeline,
      loading: false,
      notFound: false
    })
  },

  onCopyTracking() {
    const express = this.data.order && this.data.order.express
    if (!express || !express.trackingNo) return
    wx.setClipboardData({ data: express.trackingNo })
  },

  onCopyPickupCode() {
    const pickup = this.data.order && this.data.order.pickup
    if (!pickup || !pickup.code) return
    wx.setClipboardData({ data: pickup.code })
  },

  onPay() {
    callFn('pay', { orderId: this.data.id })
      .then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.fetch()
      })
      .catch(() => {})
  },

  onCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单？库存将自动恢复。',
      success: (res) => {
        if (!res.confirm) return
        callFn('cancelOrder', { orderId: this.data.id })
          .then(() => {
            wx.showToast({ title: '已取消', icon: 'success' })
            this.fetch()
          })
          .catch(() => {})
      }
    })
  },

  onConfirm() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      success: (res) => {
        if (!res.confirm) return
        callFn('confirmReceive', { orderId: this.data.id })
          .then(() => {
            wx.showToast({ title: '已确认收货', icon: 'success' })
            this.fetch()
          })
          .catch(() => {})
      }
    })
  },

  goList() {
    wx.redirectTo({ url: '/pages/order/list/list' })
  }
})
