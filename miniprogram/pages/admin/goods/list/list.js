const { callFn } = require('../../../../utils/request')
const { fenToYuan } = require('../../../../utils/format')
const { PAGE_SIZE } = require('../../../../utils/config')

Page({
  data: {
    list: [],
    page: 0,
    loading: false,
    noMore: false
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

  reset() {
    this.setData({ list: [], page: 0, noMore: false })
    this.fetch(0)
  },

  fetch(page) {
    this.setData({ loading: true })
    const db = wx.cloud.database()
    db.collection('goods')
      .orderBy('status', 'desc')
      .orderBy('sort', 'asc')
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get()
      .then((res) => {
        const rows = (res.data || []).map((item) => this.decorate(item))
        this.setData({
          list: page === 0 ? rows : this.data.list.concat(rows),
          page,
          loading: false,
          noMore: rows.length < PAGE_SIZE
        })
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '商品加载失败', icon: 'none' })
      })
  },

  decorate(item) {
    return Object.assign({}, item, {
      priceText: fenToYuan(item.price || 0),
      onSale: item.status === 'on_sale',
      sold: item.sold || 0
    })
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id
    const status = e.detail.value ? 'on_sale' : 'off_sale'
    callFn('adminGoods', { action: 'toggleStatus', payload: { id, status } })
      .then(() => {
        this.patch(id, { status, onSale: status === 'on_sale' })
        wx.showToast({ title: status === 'on_sale' ? '已上架' : '已下架', icon: 'none' })
      })
      .catch(() => {
        // 失败时回滚开关状态
        this.patch(id, { status: status === 'on_sale' ? 'off_sale' : 'on_sale', onSale: status !== 'on_sale' })
      })
  },

  onMinus(e) {
    const item = this.find(e.currentTarget.dataset.id)
    if (!item || item.stock <= 0) return
    this.saveStock(item._id, item.stock - 1)
  },

  onPlus(e) {
    const item = this.find(e.currentTarget.dataset.id)
    if (!item) return
    this.saveStock(item._id, item.stock + 1)
  },

  onEditStock(e) {
    const item = this.find(e.currentTarget.dataset.id)
    if (!item) return
    wx.showModal({
      title: '修改库存',
      editable: true,
      placeholderText: '请输入不小于 0 的整数',
      content: String(item.stock),
      success: (res) => {
        if (!res.confirm) return
        const stock = Number(res.content)
        if (!Number.isInteger(stock) || stock < 0) {
          wx.showToast({ title: '请输入不小于 0 的整数', icon: 'none' })
          return
        }
        this.saveStock(item._id, stock)
      }
    })
  },

  saveStock(id, stock) {
    callFn('adminGoods', { action: 'setStock', payload: { id, stock } })
      .then(() => {
        this.patch(id, { stock })
        wx.showToast({ title: '库存已更新', icon: 'none' })
      })
      .catch(() => {})
  },

  onEdit(e) {
    wx.navigateTo({ url: '/pages/admin/goods/edit/edit?id=' + e.currentTarget.dataset.id })
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/admin/goods/edit/edit' })
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除商品',
      content: '确定删除该商品？已有订单的商品只能下架。',
      success: (res) => {
        if (!res.confirm) return
        callFn('adminGoods', { action: 'remove', payload: { id } })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.reset()
          })
          .catch(() => {})
      }
    })
  },

  find(id) {
    return this.data.list.filter((item) => item._id === id)[0] || null
  },

  patch(id, fields) {
    const list = this.data.list.map((item) => (item._id === id ? Object.assign({}, item, fields) : item))
    this.setData({ list })
  }
})
