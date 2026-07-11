import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import AccountLayout from './AccountLayout'

export default function PurchaseHistory() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  useEffect(() => {
    client.get('/me/orders')
      .then(({ data }) => setOrders(data.items || []))
      .catch((err) => {
        setError(err.response?.data?.error || err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const copyToClipboard = (text, itemId) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(itemId)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'fulfilled':
      case 'paid':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'pending_payment':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'cancelled':
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  return (
    <AccountLayout>
      <h2 className="mb-6 text-2xl font-bold text-slate-100">Purchase History</h2>
      
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex py-12 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center">
          <div className="flex justify-center mb-3">
            <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-slate-300">No purchases yet</h3>
          <p className="text-sm text-slate-500">Your bought items and game keys will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/35 p-5 shadow-lg">
              {/* Order Meta Header */}
              <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/account/history/${order.id}`} className="text-sm font-semibold text-slate-200 hover:text-violet-400 transition">
                      Order #{order.order_number}
                    </Link>
                    <span className={`rounded-xl border px-2 py-0.5 text-[10px] font-semibold uppercase ${getStatusStyle(order.status)}`}>
                      {(order.status || '').replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Placed on {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-left sm:text-right flex sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-3 sm:gap-1.5 w-full sm:w-auto">
                  <div>
                    <span className="text-xs text-slate-500 block">Total Price</span>
                    <span className="font-mono text-sm font-bold text-violet-400">${parseFloat(order.total || 0).toFixed(2)}</span>
                  </div>
                  <Link
                    to={`/account/history/${order.id}`}
                    className="rounded-lg border border-slate-700 hover:border-slate-650 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900 transition flex items-center gap-1.5"
                  >
                    <svg className="h-3.5 w-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    View Tracker
                  </Link>
                </div>
              </div>

              {/* Items and credentials listing */}
              <div className="space-y-4">
                {order.items?.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-850 bg-slate-950/40 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">{item.title_snapshot}</h4>
                        {item.product && (
                          <p className="text-[10px] text-slate-550 capitalize mt-0.5">
                            {item.product.product_type}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        {item.qty} x ${parseFloat(item.unit_price || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Decrypted payload copy box */}
                    {item.secret_payload ? (
                      <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-violet-500/20 bg-violet-650/5 px-3 py-2">
                        <span className="font-mono text-xs text-violet-400 select-all overflow-x-auto whitespace-nowrap">
                          {item.secret_payload}
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.secret_payload, item.id)}
                          className="rounded-lg bg-violet-600/20 border border-violet-500/40 px-2 py-1 text-[10px] font-semibold text-violet-400 hover:bg-violet-600 hover:text-white transition"
                        >
                          {copiedKey === item.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    ) : order.status === 'pending_payment' ? (
                      <div className="mt-2 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-lg">
                        Waiting for scan and pay approval.
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountLayout>
  )
}
