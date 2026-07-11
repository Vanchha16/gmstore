import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { cancelOrder } from '../../api/endpoints'
import { useCart } from '../../context/CartContext'
import AccountLayout from './AccountLayout'

const STEPS = [
  {
    key: 'placed',
    label: 'Order Placed',
    desc: 'We received your order',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: 'paid',
    label: 'Payment Confirmed',
    desc: 'Your payment was verified',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'preparing',
    label: 'Being Prepared',
    desc: 'Admin is processing your order',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'delivered',
    label: 'Delivered',
    desc: 'Your credentials are ready!',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
]

// Returns 0–100 progress percentage
function getProgress(status) {
  if (status === 'fulfilled')       return 100
  if (status === 'paid')            return 55   // between step 2 and 3
  if (status === 'awaiting_stock')  return 35   // paid, but we still need to source the item
  if (status === 'pending_payment') return 12
  return null  // cancelled/failed — hide tracker
}

// Which step index is "active" (currently happening)
function getActiveStep(status) {
  if (status === 'fulfilled')       return 3
  if (status === 'paid')            return 2   // being prepared
  if (status === 'awaiting_stock')  return 2   // being sourced, same visual step as "being prepared"
  if (status === 'pending_payment') return 0
  return -1
}

function OrderTracker({ status, paidAt, fulfilledAt }) {
  const progress = getProgress(status)
  if (progress === null) return null
  const activeStep = getActiveStep(status)

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-slate-200 tracking-wide">Delivery Tracker</h3>
        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
          status === 'fulfilled'       ? 'bg-emerald-500/15 text-emerald-400' :
          status === 'paid'            ? 'bg-violet-500/15 text-violet-400' :
          status === 'awaiting_stock'  ? 'bg-orange-500/15 text-orange-400' :
          status === 'pending_payment' ? 'bg-amber-500/15 text-amber-400' :
                                         'bg-slate-700 text-slate-400'
        }`}>
          {status === 'fulfilled' ? 'Delivered' :
           status === 'paid' ? 'Processing' :
           status === 'awaiting_stock' ? 'Sourcing Item' :
           status === 'pending_payment' ? 'Awaiting Payment' : status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative mb-8">
        <div className="h-2 w-full rounded-full bg-slate-800" />
        <div
          className="absolute top-0 left-0 h-2 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progress}%`,
            background: progress === 100
              ? 'linear-gradient(90deg, #7c3aed, #10b981)'
              : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          }}
        />
        {/* Animated pulse on the tip when not done */}
        {progress < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-violet-500 border-2 border-slate-900 shadow-lg shadow-violet-500/50 animate-pulse"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        )}
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-1">
        {STEPS.map((step, i) => {
          const done = i < activeStep || status === 'fulfilled'
          const active = i === activeStep && status !== 'fulfilled'
          return (
            <div key={step.key} className="flex flex-col items-center text-center gap-2">
              {/* Icon circle */}
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                done
                  ? 'border-violet-500 bg-violet-600/20 text-violet-400'
                  : active
                  ? 'border-violet-400 bg-violet-500/10 text-violet-300 shadow-md shadow-violet-500/20'
                  : 'border-slate-700 bg-slate-800/50 text-slate-600'
              } ${active ? 'scale-110' : ''}`}>
                {done ? (
                  <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.icon}
              </div>

              {/* Label */}
              <div>
                <p className={`text-[11px] font-semibold leading-tight ${
                  done ? 'text-violet-400' : active ? 'text-slate-200' : 'text-slate-600'
                }`}>
                  {step.label}
                </p>
                {active && (
                  <p className="mt-0.5 text-[10px] text-slate-500 leading-tight">{step.desc}</p>
                )}
                {done && i === 1 && paidAt && (
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {new Date(paidAt + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {done && i === 3 && fulfilledAt && (
                  <p className="mt-0.5 text-[10px] text-emerald-600">
                    {new Date(fulfilledAt + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Active step message */}
      {status === 'paid' && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
          <p className="text-xs text-violet-300">
            Your order is being processed. Credentials will be delivered to your account shortly.
          </p>
        </div>
      )}
      {status === 'awaiting_stock' && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
          <p className="text-xs text-orange-300">
            Payment confirmed! This item is sourced on demand — we're acquiring it now and
            you'll be notified as soon as it's ready for delivery.
          </p>
        </div>
      )}
      {status === 'fulfilled' && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
          <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-emerald-300">
            Delivery complete! Your credentials are shown below.
          </p>
        </div>
      )}
      {status === 'pending_payment' && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Waiting for payment confirmation. Scan the QR code to complete your purchase.
          </p>
        </div>
      )}
    </div>
  )
}

const STATUS_STYLE = {
  fulfilled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  awaiting_stock: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  refunded: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refreshCart } = useCart()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [agreedRefundPolicy, setAgreedRefundPolicy] = useState(false)

  useEffect(() => {
    client.get(`/me/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch((err) => setError(err.response?.data?.error || 'Order not found.'))
      .finally(() => setLoading(false))
  }, [id])

  const copy = (text, itemId) => {
    navigator.clipboard.writeText(text)
    setCopiedId(itemId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this order and release the stock reservation?')) return
    setCancelling(true)
    try {
      await cancelOrder(order.id)
      refreshCart()
      setOrder((o) => ({ ...o, status: 'cancelled' }))
    } catch (err) {
      alert(err.response?.data?.error || 'Could not cancel order.')
    } finally {
      setCancelling(false)
    }
  }

  const handleConfirmDelivery = async () => {
    if (!agreedRefundPolicy) return
    setConfirming(true)
    try {
      const { data } = await client.post(`/me/orders/${order.id}/confirm-delivery`)
      setOrder(data.order || { ...order, delivery_confirmed: true })
      setShowConfirmModal(false)
    } catch (err) {
      alert(err.response?.data?.error || 'Could not confirm delivery.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return (
    <AccountLayout>
      <div className="flex py-16 justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    </AccountLayout>
  )

  if (error || !order) return (
    <AccountLayout>
      <p className="text-red-400">{error || 'Order not found.'}</p>
      <Link to="/account/history" className="mt-4 block text-sm text-violet-400">← Back to history</Link>
    </AccountLayout>
  )

  const statusStyle = STATUS_STYLE[order.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  return (
    <AccountLayout>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link to="/account/history" className="mb-1 block text-xs text-slate-500 hover:text-slate-300">← Purchase History</Link>
          <h2 className="text-2xl font-bold text-slate-100">Order #{order.order_number}</h2>
        </div>
        <span className={`rounded-xl border px-3 py-1 text-xs font-semibold uppercase ${statusStyle}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      <OrderTracker status={order.status} paidAt={order.paid_at} fulfilledAt={order.fulfilled_at} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-slate-200">Items</h3>
          {order.items?.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-slate-100">{item.title_snapshot}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{item.product?.product_type}</p>
                </div>
                <span className="font-mono text-sm text-slate-400">×{item.qty} · ${parseFloat(item.unit_price).toFixed(2)}</span>
              </div>

              {item.secret_payload ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2.5">
                  <span className="font-mono text-sm text-violet-300 select-all break-all">{item.secret_payload}</span>
                  <button onClick={() => copy(item.secret_payload, item.id)}
                    className="flex-shrink-0 rounded-lg border border-violet-500/40 bg-violet-600/20 px-3 py-1 text-xs font-semibold text-violet-400 hover:bg-violet-600 hover:text-white transition">
                    {copiedId === item.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : order.status === 'pending_payment' ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                  Awaiting payment confirmation.
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <h3 className="mb-4 font-semibold text-slate-200">Summary</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">${parseFloat(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span className="font-mono text-emerald-400">-${parseFloat(order.discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-semibold text-slate-100">
                <span>Total</span>
                <span className="font-mono text-violet-400">${parseFloat(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400 space-y-2">
            <h3 className="mb-3 font-semibold text-slate-200">Details</h3>
            <div className="flex justify-between">
              <span>Placed</span>
              <span className="text-slate-300">{new Date(order.created_at + 'Z').toLocaleString()}</span>
            </div>
            {order.paid_at && (
              <div className="flex justify-between">
                <span>Paid</span>
                <span className="text-emerald-400">{new Date(order.paid_at + 'Z').toLocaleString()}</span>
              </div>
            )}
            {order.fulfilled_at && (
              <div className="flex justify-between">
                <span>Delivered</span>
                <span className="text-emerald-400">{new Date(order.fulfilled_at + 'Z').toLocaleString()}</span>
              </div>
            )}
            {order.payments?.[0] && (
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="uppercase text-slate-300">{order.payments[0].provider} · {order.payments[0].method}</span>
              </div>
            )}
          </div>

          {order.status === 'pending_payment' && (
            <button onClick={handleCancel} disabled={cancelling}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
              {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </button>
          )}

          {order.status === 'fulfilled' && (
            <div className="space-y-2">
              {order.delivery_confirmed ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-center text-xs font-semibold text-emerald-400">
                  ✓ Delivery Confirmed (Cannot be refunded)
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAgreedRefundPolicy(false)
                    setShowConfirmModal(true)
                  }}
                  disabled={confirming}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  {confirming ? 'Confirming…' : 'Confirm Delivery'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="mb-4 text-lg font-bold text-slate-100 flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Confirm Delivery
            </h3>
            
            <div className="space-y-3 text-sm text-slate-400">
              <p>
                Please review the refund policy details below before confirming the receipt of your credentials:
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-400 font-medium">
                ⚠️ IMPORTANT RULE: Once you confirm delivery, this order is considered fully completed. Under our terms of service, this order cannot be refunded.
              </div>
              <p>
                Ensure you have successfully accessed your account or checked the credentials provided.
              </p>
            </div>

            <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedRefundPolicy}
                onChange={(e) => setAgreedRefundPolicy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-950"
              />
              <span className="text-xs font-medium text-slate-400">
                I agree and understand that this order cannot be refunded once confirmed.
              </span>
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelivery}
                disabled={!agreedRefundPolicy || confirming}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {confirming ? 'Confirming…' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  )
}
