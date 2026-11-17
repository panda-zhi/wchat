const { PAGE_SIZE } = require('../../utils/config')
const { decorateStock } = require('../../utils/goods')
const { fenToYuan } = require('../../utils/format')

const CATEGORIES = [
  { label: '全部', value: '' },
  { label: '时令水果', value: 'seasonal' },
  { label: '进口水果', value: 'imported' },
  { label: '果切拼盘', value: 'cut' },
  { label: '礼盒', value: 'gift' }
]

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: '',
    list: [],
    page: 0,
    loading: false,
    noMore: false,
    loadFailed: false
  },

  onLoad() {
    this.seq = 0
    this.fetch(0, true)
  },

  onPullDownRefresh() {
    this.fetch(0, true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.loading || this.data.noMore) return
    this.fetch(this.data.page + 1, false)
  },

  onTapCategory(e) {
    const value = e.currentTarget.dataset.value || ''
    if (value === this.data.activeCategory) return
    this.setData({ activeCategory: value })
    this.fetch(0, true)
  },

  onTapGoods(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/goods/detail/detail?id=' + id })
  },

  onRetry() {
    this.fetch(this.data.page, this.data.list.length === 0)
  },

  fetch(page, reset) {
    const seq = ++this.seq
    if (reset) {
      this.setData({ loading: true, loadFailed: false, noMore: false })
    } else {
      this.setData({ loading: true, loadFailed: false })
    }

    const where = { status: 'on_sale' }
    if (this.data.activeCategory) {
      where.category = this.data.activeCategory
    }

    return wx.cloud
      .database()
      .collection('goods')
      .where(where)
      .orderBy('sort', 'asc')
      .orderBy('createdAt', 'desc')
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get()
      .then((res) => {
        if (seq !== this.seq) return
        const rows = (res.data || []).map((item) =>
          Object.assign({}, item, { priceText: fenToYuan(item.price) }, decorateStock(item))
        )
        this.setData({
          list: reset ? rows : this.data.list.concat(rows),
          page,
          noMore: rows.length < PAGE_SIZE,
          loading: false
        })
      })
      .catch(() => {
        if (seq !== this.seq) return
        this.setData({ loading: false, loadFailed: true })
      })
  }
})
