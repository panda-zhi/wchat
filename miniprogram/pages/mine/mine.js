const { callFn } = require('../../utils/request')

const ORDER_ENTRIES = [
  { key: 'pending_pay', label: '待付款' },
  { key: 'paid', label: '待发货' },
  { key: 'shipped', label: '待收货' }
]

Page({
  data: {
    openid: '',
    isAdmin: false,
    orderEntries: ORDER_ENTRIES
  },

  onShow() {
    const app = getApp()
    this.setData({ openid: app.globalData.openid || '' })
    this.checkAdmin()
  },

  // 仅用于决定是否渲染商家入口；真正的权限校验在每个 admin 云函数首行。
  checkAdmin() {
    callFn('adminCheck', {}, { loading: false })
      .then((data) => {
        const isAdmin = !!(data && data.isAdmin)
        if (data && data.openid) {
          getApp().globalData.openid = data.openid
        }
        this.setData({ isAdmin, openid: (data && data.openid) || this.data.openid })
      })
      .catch(() => {
        this.setData({ isAdmin: false })
      })
  },

  goOrders(e) {
    const tab = e.currentTarget.dataset.tab
    wx.navigateTo({ url: '/pages/order/list/list?tab=' + tab })
  },

  goAddress() {
    wx.navigateTo({ url: '/pages/address/list/list' })
  },

  goAdminGoods() {
    wx.navigateTo({ url: '/pages/admin/goods/list/list' })
  },

  goAdminOrders() {
    wx.navigateTo({ url: '/pages/admin/order/list/list' })
  },

  goAdminVerify() {
    wx.navigateTo({ url: '/pages/admin/order/verify/verify' })
  }
})
