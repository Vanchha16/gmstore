import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminListOrders, adminUpdateOrder, adminRefundOrder, adminDeliverOrder } from '../../api/endpoints'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../context/ToastContext'

const STATUS_COLORS = {
  pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  fulfilled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  refunded: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function AdminOrders() {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'deliver' | 'refund', orderId }

  const limit = 20

  const load = (pg = 1) => {
    setLoading(true)
    adminListOrders({ page: pg, limit, status: statusFilter || undefined, q: search || undefined })
      .then(({ data }) => {
        setOrders(data.items)
        setTotal(data.total)
        setPage(pg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [statusFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    load(1)
  }

  const handleStatusChange = async (orderId, newStatus) => {
    setActionLoading(orderId)
    try {
      const { data } = await adminUpdateOrder(orderId, { status: newStatus })
      setOrders(prev => prev.map(o => o.id === orderId ? data : o))
    } catch (err) {
      toast(err.response?.data?.error || 'Update failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const requestDeliver = (orderId) => setConfirmAction({ type: 'deliver', orderId })

  const requestRefund = (orderId, order) => {
    if (order.delivery_confirmed) {
      toast('This order delivery is confirmed by the customer and cannot be refunded.', 'warning')
      return
    }
    setConfirmAction({ type: 'refund', orderId })
  }

  const runConfirmedAction = async () => {
    if (!confirmAction) return
    const { type, orderId } = confirmAction
    setActionLoading(orderId)
    try {
      if (type === 'deliver') {
        const { data } = await adminDeliverOrder(orderId)
        setOrders(prev => prev.map(o => o.id === orderId ? data.order : o))
        toast('Order delivered to buyer.', 'success')
      } else if (type === 'refund') {
        const { data } = await adminRefundOrder(orderId)
        setOrders(prev => prev.map(o => o.id === orderId ? data.order : o))
        toast('Order marked as refunded.', 'success')
      }
    } catch (err) {
      toast(err.response?.data?.error || `${type === 'deliver' ? 'Delivery' : 'Refund'} failed`, 'error')
    } finally {
      setActionLoading(null)
      setConfirmAction(null)
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Manage Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} total orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Order number…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition">
            Search
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
        >
          <option value="">All statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Deliver</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No orders found.</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {orders.map(order => (
            <div key={order.id} className="py-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <span className="font-mono text-sm font-bold text-slate-200">{order.order_number}</span>
                  <span className="ml-3 text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                  {order.is_preorder && (
                    <span className="ml-2 rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                      Pre-order
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[order.status] || ''}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    ${parseFloat(order.total).toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-600 transition"
                  >
                    {expanded === order.id ? 'Collapse' : 'Details'}
                  </button>
                  {order.status === 'paid' && (
                    <button
                      onClick={() => requestDeliver(order.id)}
                      disabled={actionLoading === order.id}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 animate-pulse"
                    >
                      ✦ Deliver
                    </button>
                  )}
                  {(order.status === 'paid' || order.status === 'fulfilled') && (
                    <button
                      onClick={() => requestRefund(order.id, order)}
                      disabled={actionLoading === order.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        order.delivery_confirmed
                          ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                      }`}
                      title={order.delivery_confirmed ? 'Delivery confirmed by customer (cannot refund)' : ''}
                    >
                      Refund
                    </button>
                  )}
                  {order.status === 'pending_payment' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'cancelled')}
                      disabled={actionLoading === order.id}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-400 hover:border-red-500/30 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {expanded === order.id && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-slate-500">User ID</span>
                    <span className="text-slate-300">{order.user_id}</span>
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-300">${parseFloat(order.subtotal).toFixed(2)}</span>
                    <span className="text-slate-500">Discount</span>
                    <span className="text-slate-300">${parseFloat(order.discount).toFixed(2)}</span>
                    {order.paid_at && (
                      <>
                        <span className="text-slate-500">Paid At</span>
                        <span className="text-slate-300">{new Date(order.paid_at).toLocaleString()}</span>
                      </>
                    )}
                    {order.delivery_confirmed && (
                      <>
                        <span className="text-emerald-400 font-semibold">Delivery Confirmed</span>
                        <span className="text-emerald-400 font-semibold">Yes (Cannot refund)</span>
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Items</p>
                    <div className="space-y-1.5">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-slate-300">{item.title_snapshot}</span>
                          <span className="font-mono text-slate-400">${parseFloat(item.unit_price).toFixed(2)} × {item.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.payments?.length > 0 && (
                    <div className="border-t border-slate-800 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment</p>
                      {order.payments.map(p => (
                        <div key={p.id} className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-slate-500">Provider</span>
                          <span className="text-slate-300">{p.provider}</span>
                          <span className="text-slate-500">Method</span>
                          <span className="text-slate-300">{p.method}</span>
                          <span className="text-slate-500">Status</span>
                          <span className="text-slate-300">{p.status}</span>
                          {p.provider_txn_id && (
                            <>
                              <span className="text-slate-500">Txn ID</span>
                              <span className="font-mono text-slate-300 truncate">{p.provider_txn_id}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map(pg => (
            <button
              key={pg}
              onClick={() => load(pg)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                pg === page
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pg}
            </button>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.type === 'deliver' ? 'Deliver this order?' : 'Refund this order?'}
        message={
          confirmAction?.type === 'deliver'
            ? 'This will mark the order as fulfilled, reveal the credentials to the buyer, and email them.'
            : 'This will mark the order as refunded. This cannot be undone.'
        }
        confirmLabel={confirmAction?.type === 'deliver' ? 'Deliver' : 'Refund'}
        tone={confirmAction?.type === 'deliver' ? 'default' : 'danger'}
        loading={actionLoading === confirmAction?.orderId}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </AdminLayout>
  )
}
