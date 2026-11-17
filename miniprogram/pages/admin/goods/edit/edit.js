const { callFn } = require('../../../../utils/request')
const { fenToYuan } = require('../../../../utils/format')

const CATEGORIES = [
  { label: '时令水果', value: 'seasonal' },
  { label: '进口水果', value: 'imported' },
  { label: '果切拼盘', value: 'cut' },
  { label: '礼盒', value: 'gift' }
]

const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 300 * 1024

Page({
  data: {
    id: '',
    isEdit: false,
    categories: CATEGORIES,
    categoryIndex: 0,
    title: '',
    unit: '',
    priceYuan: '',
    stockText: '',
    description: '',
    images: [],
    uploading: false,
    submitting: false
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    this.setData({ id, isEdit: !!id })
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑商品' })
      this.load(id)
    } else {
      wx.setNavigationBarTitle({ title: '新增商品' })
    }
  },

  load(id) {
    wx.showLoading({ title: '加载中', mask: true })
    wx.cloud
      .database()
      .collection('goods')
      .doc(id)
      .get()
      .then((res) => {
        const goods = res.data
        if (!goods) throw new Error('商品不存在')
        const images = goods.images && goods.images.length
          ? goods.images
          : (goods.coverUrl ? [goods.coverUrl] : [])
        const index = CATEGORIES.findIndex((item) => item.value === goods.category)
        this.setData({
          title: goods.title || '',
          unit: goods.unit || '',
          priceYuan: fenToYuan(goods.price || 0),
          stockText: String(goods.stock === undefined ? 0 : goods.stock),
          description: goods.description || '',
          images,
          categoryIndex: index === -1 ? 0 : index
        })
      })
      .catch(() => {
        wx.showToast({ title: '商品加载失败', icon: 'none' })
      })
      .finally(() => wx.hideLoading())
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onChooseImages() {
    const remain = MAX_IMAGES - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多上传 5 张图片', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = res.tempFiles || []
        const tooLarge = files.some((file) => file.size > MAX_IMAGE_SIZE)
        if (tooLarge) {
          wx.showToast({ title: '图片过大，请重新选择', icon: 'none' })
          return
        }
        this.upload(files)
      }
    })
  },

  upload(files) {
    if (!files.length) return
    this.setData({ uploading: true })
    wx.showLoading({ title: '上传中', mask: true })
    const tasks = files.map((file, i) =>
      wx.cloud.uploadFile({
        cloudPath: 'goods/' + Date.now() + '-' + i + '.jpg',
        filePath: file.tempFilePath
      })
    )
    Promise.all(tasks)
      .then((results) => {
        const urls = results.map((r) => r.fileID)
        this.setData({ images: this.data.images.concat(urls) })
      })
      .catch(() => {
        wx.showToast({ title: '图片上传失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ uploading: false })
        wx.hideLoading()
      })
  },

  onRemoveImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const images = this.data.images.filter((_, i) => i !== index)
    this.setData({ images })
  },

  onSubmit() {
    if (this.data.submitting || this.data.uploading) return

    const title = this.data.title.trim()
    const unit = this.data.unit.trim()
    const price = Math.round(Number(this.data.priceYuan) * 100)
    const stock = Number(this.data.stockText)

    if (!title) return this.tip('请填写商品名称')
    if (title.length > 30) return this.tip('商品名称不能超过 30 字')
    if (!unit) return this.tip('请填写规格单位')
    if (!Number.isInteger(price) || price <= 0) return this.tip('售价必须大于 0')
    if (!Number.isInteger(stock) || stock < 0) return this.tip('库存必须为不小于 0 的整数')
    if (!this.data.images.length) return this.tip('请上传商品封面')

    const payload = {
      title,
      unit,
      price,
      stock,
      category: CATEGORIES[this.data.categoryIndex].value,
      coverUrl: this.data.images[0],
      images: this.data.images,
      description: this.data.description.trim()
    }

    this.setData({ submitting: true })
    const action = this.data.isEdit ? 'update' : 'create'
    if (this.data.isEdit) payload.id = this.data.id

    callFn('adminGoods', { action, payload })
      .then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch(() => {})
      .finally(() => this.setData({ submitting: false }))
  },

  tip(message) {
    wx.showToast({ title: message, icon: 'none' })
  }
})
