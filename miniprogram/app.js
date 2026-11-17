const { ENV_ID } = require('./utils/config')

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }
    if (ENV_ID === '请填写云开发环境ID') {
      console.warn('云开发环境 ID 未配置，请在 miniprogram/utils/config.js 中填写')
    }
    wx.cloud.init({ env: ENV_ID, traceUser: true })
  },
  globalData: {
    openid: ''
  }
})
