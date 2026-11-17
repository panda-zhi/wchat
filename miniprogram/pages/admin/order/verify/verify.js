const { callFn } = require('../../../../utils/request')

Page({
  data: {
    orderId: '',
    code: '',
    submitting: false,
    result: null
  },

  onLoad(options) {
    this.setData({ orderId: (options && options.id) || '' })
  },

  onInput(e) {
    this.setData({ code: String(e.detail.value || '').replace(/\D/g, '').slice(0, 4), result: null })
  },

  onScan() {
    wx.scanCode({
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        const match = String(res.result || '').match(/\d{4}/)
        if (!match) {
          wx.showToast({ title: '未识别到 4 位自提码', icon: 'none' })
          return
        }
        this.setData({ code: match[0], result: null })
      }
    })
  },

  onSubmit() {
    if (this.data.submitting) return
    if (!/^\d{4}$/.test(this.data.code)) {
      wx.showToast({ title: '请输入 4 位自提码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    callFn('verifyPickup', {
      orderId: this.data.orderId || undefined,
      code: this.data.code
    })
      .then(() => {
        this.setData({ result: { type: 'success', text: '核销成功，订单已完成' } })
      })
      .catch((err) => {
        this.setData({ result: { type: 'error', text: err.message || '核销失败' } })
      })
      .finally(() => this.setData({ submitting: false }))
  },

  onReset() {
    this.setData({ code: '', result: null })
  }
})
