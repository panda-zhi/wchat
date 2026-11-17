const { callFn } = require('../../../../utils/request')

const COMPANIES = [
  { code: 'SF', label: '顺丰速运' },
  { code: 'JD', label: '京东物流' },
  { code: 'ZTO', label: '中通快递' },
  { code: 'YTO', label: '圆通速递' },
  { code: 'YUNDA', label: '韵达快递' },
  { code: 'EMS', label: 'EMS' },
  { code: 'OTHER', label: '其他' }
]

Page({
  data: {
    id: '',
    order: null,
    companies: COMPANIES,
    companyIndex: 0,
    trackingNo: '',
    submitting: false
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    // 商家无权在客户端直读他人订单（安全规则限制），列表页跳转前把订单放进 globalData。
    const cached = getApp().globalData.adminShipOrder
    const order = cached && cached._id === id ? cached : null
    this.setData({ id, order })
  },

  onCompanyChange(e) {
    this.setData({ companyIndex: Number(e.detail.value) })
  },

  onInput(e) {
    this.setData({ trackingNo: e.detail.value })
  },

  onCopy(e) {
    const text = e.currentTarget.dataset.text
    if (!text) return
    wx.setClipboardData({ data: String(text) })
  },

  onSubmit() {
    if (this.data.submitting) return
    const trackingNo = this.data.trackingNo.trim()
    if (!trackingNo) {
      wx.showToast({ title: '请填写运单号', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    callFn('adminOrder', {
      action: 'ship',
      payload: {
        id: this.data.id,
        companyCode: COMPANIES[this.data.companyIndex].code,
        trackingNo
      }
    })
      .then(() => {
        getApp().globalData.adminShipOrder = null
        wx.showToast({ title: '发货成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch(() => {})
      .finally(() => this.setData({ submitting: false }))
  }
})
