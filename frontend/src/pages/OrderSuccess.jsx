import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import client from '../api/client'
import Container from '../components/layout/Container'

export default function OrderSuccess() {
  const location = useLocation()
  const { orderId } = location.state || {}
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)

  useEffect(() => {
    if (!orderId) return
    
    // Fetch detailed order (which includes decrypted stock item credentials for fulfilled status)
    client.get(`/me/orders/${orderId}`)
      .then(({ data }) => setOrder(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [orderId])

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  if (!orderId) {
    return (
      <Container>
        <div className="py-12 text-center text-slate-400">Order not found.</div>
      </Container>
    )
  }

  if (loading) {
    return (
      <Container>
        <div className="flex py-24 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container>
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="mx-auto max-w-2xl text-center mb-8">
        {/* Success Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-3xl">
          ✓
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-100">Payment Successful!</h1>
        <p className="text-sm text-slate-400">
          {order.status === 'fulfilled'
            ? 'Thank you for your purchase. Your order has been delivered below.'
            : 'Thank you for your purchase. Your items will appear here once the admin confirms delivery — check Purchase History for updates.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Delivered Inventory Credentials */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Your Delivered Items</h2>
          {order.items?.map((item, index) => (
            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-slate-100">{item.title_snapshot}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{item.product?.product_type || 'Item'}</p>
                </div>
                <span className="font-mono text-sm text-slate-400">${parseFloat(item.unit_price).toFixed(2)}</span>
              </div>

              {/* Secret Decrypted Payload Card */}
              {item.secret_payload ? (
                <div className="rounded-xl border border-violet-500/20 bg-violet-650/5 p-4 flex items-center justify-between gap-4">
                  <div className="font-mono text-sm text-violet-400 select-all overflow-x-auto whitespace-pre-wrap max-w-[80%]">
                    {item.secret_payload}
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.secret_payload, index)}
                    className="flex-shrink-0 rounded-xl bg-violet-600/20 border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-400 hover:bg-violet-600 hover:text-white transition"
                  >
                    {copiedIndex === index ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-500">
                  Credentials are encrypted or unavailable. Check purchase history.
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Invoice Summary */}
        <div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-200">Receipt Invoice</h2>
            
            <div className="space-y-3 border-b border-slate-850 pb-4 mb-4 text-sm text-slate-400">
              <div className="flex justify-between">
                <span>Order Ref</span>
                <span className="font-semibold text-slate-350">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode</span>
                <span className="font-semibold text-slate-350 uppercase">
                  {order.payments?.[0]?.provider === 'wallet' ? 'Wallet Balance' : 'KHQR (Bakong)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">${parseFloat(order.subtotal).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between font-semibold text-slate-100 mb-6">
              <span>Total Paid</span>
              <span className="font-mono text-violet-400 text-lg">${parseFloat(order.total).toFixed(2)}</span>
            </div>

            <div className="space-y-3">
              <Link
                to="/"
                className="block w-full text-center rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition shadow-md shadow-violet-950/30"
              >
                Continue Shopping
              </Link>
              <Link
                to="/account/history"
                className="block w-full text-center rounded-xl border border-slate-800 bg-slate-950/50 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                View Purchase History
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
