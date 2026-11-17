const { fenToYuan } = require('../../utils/format')

Component({
  properties: {
    value: {
      type: Number,
      value: 0,
      observer() {
        this.refresh()
      }
    },
    size: {
      type: String,
      value: 'normal'
    }
  },

  data: {
    text: '0.00'
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    refresh() {
      this.setData({ text: fenToYuan(this.data.value) })
    }
  }
})
