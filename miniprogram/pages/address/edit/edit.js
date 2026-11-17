const { validateAddress } = require('../../../utils/address')

Page({
  data: {
    id: '',
    name: '',
    phone: '',
    region: [],
    detail: '',
    isDefault: false,
    saving: false
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    if (!id) return
    this.setData({ id })
    this.fetch(id)
  },

  fetch(id) {
    wx.cloud
      .database()
      .collection('addresses')
      .doc(id)
      .get()
      .then((res) => {
        const item = res.data || {}
        this.setData({
          name: item.name || '',
          phone: item.phone || '',
          region: item.region || [],
          detail: item.detail || '',
          isDefault: !!item.isDefault
        })
      })
      .catch(() => wx.showToast({ title: '地址加载失败', icon: 'none' }))
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onRegionChange(e) {
    this.setData({ region: e.detail.value })
  },

  onDefaultChange(e) {
    this.setData({ isDefault: e.detail.value })
  },

  onSave() {
    if (this.data.saving) return

    const payload = {
      name: this.data.name.trim(),
      phone: this.data.phone.trim(),
      region: this.data.region,
      detail: this.data.detail.trim(),
      isDefault: this.data.isDefault
    }

    const check = validateAddress(payload)
    if (!check.ok) {
      wx.showToast({ title: check.message, icon: 'none' })
      return
    }

    this.setData({ saving: true })
    this.save(payload)
  },

  save(payload) {
    const db = wx.cloud.database()
    const collection = db.collection('addresses')
    const id = this.data.id

    collection
      .count()
      .then((res) => {
        if (!id && res.total >= 20) {
          throw new Error('最多保存 20 条地址')
        }
        if (!payload.isDefault) return null
        return this.clearOtherDefaults(collection)
      })
      .then(() => {
        if (id) {
          return collection.doc(id).update({ data: payload })
        }
        return collection.add({ data: Object.assign({}, payload, { createdAt: db.serverDate() }) })
      })
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch((err) => {
        this.setData({ saving: false })
        wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' })
      })
  },

  // 小程序端不支持 where().update() 批量更新，逐条改用 doc().update()
  clearOtherDefaults(collection) {
    const id = this.data.id
    return collection
      .where({ isDefault: true })
      .get()
      .then((res) => {
        const targets = (res.data || []).filter((item) => item._id !== id)
        return Promise.all(targets.map((item) => collection.doc(item._id).update({ data: { isDefault: false } })))
      })
  }
})
