const { callFn } = require('../../../../utils/request')
const { fenToYuan, formatDateTime } = require('../../../../utils/format')

const TABS = [
  { key: 'pending_ship', label: '待发货' },
  { key: 'pending_pickup', label: '待自提' },
  { key: 'shipped', label: '待收货' },
  { key: 'completed', label: '已完成' },
  { key: 'all', label: '全部' }
]

const STATUS_TEXT = {
  pending_pay: '待付款',
  paid: '待发货',
  shipped: '待收货',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款'
}

Page({
  data: {
    tabs: TABS,
    tab: 'pending_ship',
    list: [],
    page: 0,
    loading: false,
    noMore: false
  },

  onLoad(options) {
    if (options && options.tab && TABS.some((t) => t.key === options.tab)) {
      this.setData({ tab: options.tab })
    }
  },

  onShow() {
    this.reset()
  },

  onPullDownRefresh() {
    this.reset()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    if (this.data.loading || this.data.noMore) return
    this.fetch(this.data.page + 1)
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.key
    if (tab === this.data.tab) return
    this.setData({ tab })
    this.reset()
  },

  reset() {
    this.setData({ list: [], page: 0, noMore: false })
    this.fetch(0)
  },

  fetch(page) {
    this.setData({ loading: true })
    callFn('adminOrder', { action: 'list', payload: { tab: this.data.tab, page } }, { loading: false })
      .then((data) => {
        const rows = (data.list || []).map((order) => this.decorate(order))
        this.setData({
          list: page === 0 ? rows : this.data.list.concat(rows),
          page,
          loading: false,
          noMore: !data.hasMore
        })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  decorate(order) {
    const statusText = order.status === 'paid' && order.deliveryType === 'pickup'
      ? '待自提'
      : (STATUS_TEXT[order.status] || order.status)
    return Object.assign({}, order, {
      shortNo: String(order.orderNo || '').slice(-6),
      statusText,
      createdText: formatDateTime(order.createdAt),
      payAmountText: fenToYuan(order.payAmount || 0),
      deliveryText: order.deliveryType === 'pickup' ? '自提' : '快递',
      canShip: order.status === 'paid' && order.deliveryType === 'express',
      canVerify: order.status === 'paid' && order.deliveryType === 'pickup',
      canRefund: order.status === 'paid' || order.status === 'shipped'
    })
  },

  onShip(e) {
    const order = this.find(e.currentTarget.dataset.id)
    if (!order) return
    getApp().globalData.adminShipOrder = order
    wx.navigateTo({ url: '/pages/admin/order/ship/ship?id=' + order._id })
  },

  onVerify(e) {
    wx.navigateTo({ url: '/pages/admin/order/verify/verify?id=' + e.currentTarget.dataset.id })
  },

  onRefund(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '标记退款',
      content: '确定将该订单标记为已退款？',
      success: (res) => {
        if (!res.confirm) return
        callFn('adminOrder', { action: 'markRefunded', payload: { id } })
          .then(() => {
            wx.showToast({ title: '已标记退款', icon: 'success' })
            this.reset()
          })
          .catch(() => {})
      }
    })
  },

  find(id) {
    return this.data.list.filter((item) => item._id === id)[0] || null
  }
})
