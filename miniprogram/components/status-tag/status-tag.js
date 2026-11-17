const LABELS = {
  pending_pay: '待付款',
  paid: '待发货',
  paid_pickup: '待自提',
  shipped: '待收货',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款'
}

Component({
  properties: {
    status: {
      type: String,
      value: 'pending_pay',
      observer() {
        this.refresh()
      }
    },
    deliveryType: {
      type: String,
      value: 'express',
      observer() {
        this.refresh()
      }
    }
  },

  data: {
    label: '',
    tone: 'default'
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    refresh() {
      const status = this.data.status
      const key = status === 'paid' && this.data.deliveryType === 'pickup' ? 'paid_pickup' : status
      let tone = 'default'
      if (status === 'pending_pay') tone = 'warn'
      if (status === 'paid' || status === 'shipped') tone = 'primary'
      if (status === 'completed') tone = 'success'
      if (status === 'cancelled') tone = 'muted'
      this.setData({ label: LABELS[key] || '未知状态', tone })
    }
  }
})
