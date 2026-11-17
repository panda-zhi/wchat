const { callFn } = require('../../../utils/request')
const { fenToYuan, formatDateTime } = require('../../../utils/format')
const { PAGE_SIZE } = require('../../../utils/config')

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_pay', label: '待付款' },
  { key: 'paid', label: '待发货' },
  { key: 'shipped', label: '待收货' },
  { key: 'pickup', label: '待自提' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
]

function buildWhere(key, _) {
  const base = { hiddenByUser: _.neq(true) }
  if (key === 'all') return base
  if (key === 'paid') return Object.assign(base, { status: 'paid', deliveryType: 'express' })
  if (key === 'pickup') return Object.assign(base, { status: 'paid', deliveryType: 'pickup' })
  return Object.assign(base, { status: key })
}

Page({
  data: {
    tabs: TABS,
    tab: 'all',
    list: [],
    loading: true,
    finished: false
  },

  onLoad(options) {
    if (options && options.tab) {
      const hit = TABS.some((tab) => tab.key === options.tab)
      if (hit) this.setData({ tab: options.tab })
    }
    this.reset()
  },

  onPullDownRefresh() {
    this.reset()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading) return
    this.fetch()
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.key
    if (tab === this.data.tab) return
    this.setData({ tab })
    this.reset()
  },

  reset() {
    this.setData({ list: [], finished: false })
    this.fetch(true)
  },

  fetch(first) {
    if (this.data.loading && !first) return
    this.setData({ loading: true })
    const db = wx.cloud.database()
    db.collection('orders')
      .where(buildWhere(this.data.tab, db.command))
      .orderBy('createdAt', 'desc')
      .skip(first ? 0 : this.data.list.length)
      .limit(PAGE_SIZE)
      .get()
      .then((res) => {
        const rows = (res.data || []).map((order) => this.decorate(order))
        this.setData({
          list: first ? rows : this.data.list.concat(rows),
          loading: false,
          finished: rows.length < PAGE_SIZE
        })
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '订单加载失败', icon: 'none' })
      })
  },

  decorate(order) {
    const items = order.items || []
    const totalCount = items.reduce((sum, item) => sum + item.count, 0)
    return Object.assign({}, order, {
      shortNo: String(order.orderNo || '').slice(-6),
      totalCount,
      titleText: items.length === 1 ? items[0].title : items[0].title + ' 等 ' + items.length + ' 件商品',
      coverUrl: items.length ? items[0].coverUrl : '',
      payAmountText: fenToYuan(order.payAmount || 0),
      createdText: formatDateTime(order.createdAt)
    })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/order/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  onCancel(e) {
    const id = e.currentTarget.dataset.id
    this.act(id, '取消订单', () => callFn('cancelOrder', { orderId: id }))
  },

  onHide(e) {
    const id = e.currentTarget.dataset.id
    this.act(id, '删除订单', () => callFn('cancelOrder', { orderId: id, action: 'hide' }))
  },

  onPay(e) {
    const id = e.currentTarget.dataset.id
    callFn('pay', { orderId: id })
      .then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.reset()
      })
      .catch(() => {})
  },

  onConfirm(e) {
    const id = e.currentTarget.dataset.id
    callFn('confirmReceive', { orderId: id })
      .then(() => {
        wx.showToast({ title: '已确认收货', icon: 'success' })
        this.reset()
      })
      .catch(() => {})
  },

  act(id, title, run) {
    wx.showModal({
      title,
      content: '确定' + title + '？',
      success: (res) => {
        if (!res.confirm) return
        run()
          .then(() => {
            wx.showToast({ title: '操作成功', icon: 'success' })
            this.reset()
          })
          .catch(() => {})
      }
    })
  }
})
