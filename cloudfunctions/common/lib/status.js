/** 订单状态常量与流转规则。 */

const ORDER_STATUS = {
  PENDING_PAY: 'pending_pay',
  PAID: 'paid',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded'
}

const TRANSITIONS = {
  pending_pay: ['paid', 'cancelled'],
  paid: ['shipped', 'completed', 'refunding'],
  shipped: ['completed'],
  refunding: ['refunded']
}

function canTransit(from, to) {
  const allowed = TRANSITIONS[from]
  if (!allowed) return false
  return allowed.indexOf(to) !== -1
}

module.exports = { ORDER_STATUS, canTransit }
