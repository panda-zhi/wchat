Component({
  properties: {
    text: {
      type: String,
      value: '暂无数据'
    },
    buttonText: {
      type: String,
      value: ''
    }
  },

  methods: {
    onTap() {
      if (!this.data.buttonText) return
      this.triggerEvent('action')
    }
  }
})
