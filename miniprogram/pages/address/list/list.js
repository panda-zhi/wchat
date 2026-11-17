const MAX_ADDRESSES = 20

function maskPhone(phone) {
  const value = phone || ''
  if (value.length !== 11) return value
  return value.slice(0, 3) + '****' + value.slice(7)
}

Page({
  data: {
    list: [],
    loading: true
  },

  onShow() {
    this.fetch()
  },

  fetch() {
    this.setData({ loading: true })
    wx.cloud
      .database()
      .collection('addresses')
      .orderBy('isDefault', 'desc')
      .orderBy('createdAt', 'desc')
      .get()
      .then((res) => {
        const list = (res.data || []).map((item) =>
          Object.assign({}, item, {
            phoneMasked: maskPhone(item.phone),
            regionText: (item.region || []).join(' ')
          })
        )
        this.setData({ list, loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '地址加载失败', icon: 'none' })
      })
  },

  onAdd() {
    if (this.data.list.length >= MAX_ADDRESSES) {
      wx.showToast({ title: '最多保存 ' + MAX_ADDRESSES + ' 条地址', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/address/edit/edit' })
  },

  onEdit(e) {
    wx.navigateTo({ url: '/pages/address/edit/edit?id=' + e.currentTarget.dataset.id })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除地址',
      content: '确定删除这条收货地址？',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud
          .database()
          .collection('addresses')
          .doc(id)
          .remove()
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.fetch()
          })
          .catch(() => wx.showToast({ title: '删除失败，请重试', icon: 'none' }))
      }
    })
  }
})
