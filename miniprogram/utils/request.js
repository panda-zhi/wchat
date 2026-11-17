/**
 * 调用云函数并解包统一响应体 { ok, data?, code?, message? }。
 * 失败时给出 toast 并 reject 带 code 的 Error。
 */
function callFn(name, data = {}, opts = {}) {
  const loading = opts.loading !== false
  if (loading) {
    wx.showLoading({ title: '加载中', mask: true })
  }

  return wx.cloud
    .callFunction({ name, data })
    .then((res) => {
      const result = res && res.result
      if (!result) {
        const err = new Error('服务异常')
        err.code = -1
        throw err
      }
      if (result.ok === false) {
        if (result.message) {
          wx.showToast({ title: result.message, icon: 'none' })
        }
        const err = new Error(result.message || '操作失败')
        err.code = result.code
        throw err
      }
      return result.data
    })
    .catch((err) => {
      if (!err.code) {
        err.code = -1
        wx.showToast({ title: err.message || '网络异常，请稍后重试', icon: 'none' })
      }
      throw err
    })
    .finally(() => {
      if (loading) {
        wx.hideLoading()
      }
    })
}

module.exports = { callFn }
