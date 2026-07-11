import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { checkout, getWallet } from '../api/endpoints'
import Container from '../components/layout/Container'

export default function Checkout() {
  const { cart, loading: cartLoading } = useCart()
  const [method, setMethod] = useState('khqr')
  const [useWallet, setUseWallet] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getWallet().then(({ data }) => setWalletBalance(parseFloat(data.wallet.balance))).catch(() => {})
  }, [])

  const items = cart?.items || []
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const total = subtotal
  const canPayFullyWithWallet = walletBalance >= total && total > 0
  const onDemandItems = items.filter(item => item.product?.status === 'active' && item.product?.available_stock === 0)

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = method === 'wallet'
        ? { method: 'wallet' }
        : { method, use_wallet: useWallet }
      const { data } = await checkout(payload)

      if (!data.payment_details) {
        // Fully covered by wallet — no QR needed, order already paid.
        navigate('/order-success', { state: { orderId: data.order.id } })
        return
      }

      // Proceed to the QR Payment Page, passing the generated order & payment credentials
      navigate('/payment/khqr', {
        state: {
          order: data.order,
          paymentDetails: data.payment_details
        }
      })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  if (cartLoading && !cart) {
    return (
      <Container>
        <div className="flex py-24 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <h1 className="mb-8 text-3xl font-bold text-slate-100">Checkout</h1>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {onDemandItems.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          ⏳ {onDemandItems.map(i => i.product.title).join(', ')} {onDemandItems.length > 1 ? 'are' : 'is'} currently
          sourced on demand — we'll acquire {onDemandItems.length > 1 ? 'these items' : 'this item'} after your
          payment confirms, so delivery may take longer than usual. You'll be notified as soon as it's ready.
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <h2 className="text-xl font-semibold text-slate-350">No items to checkout</h2>
          <p className="text-sm text-slate-500">Go back to your cart and add items first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Order Details & Payment Methods */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method Selector */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-200">Select Payment Method</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* KHQR Card */}
                <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  method === 'khqr' 
                    ? 'border-violet-500 bg-violet-650/10 text-slate-100' 
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="khqr"
                    checked={method === 'khqr'}
                    onChange={() => setMethod('khqr')}
                    className="sr-only"
                  />
                  <span className="text-2xl">📱</span>
                  <span className="text-sm font-semibold">Bakong KHQR</span>
                </label>

                {/* ABA PAY Card */}
                <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  method === 'abapay' 
                    ? 'border-violet-500 bg-violet-650/10 text-slate-100' 
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="abapay"
                    checked={method === 'abapay'}
                    onChange={() => setMethod('abapay')}
                    className="sr-only"
                  />
                  <span className="text-2xl">🏦</span>
                  <span className="text-sm font-semibold">ABA PAY</span>
                </label>

                {/* Credit Card */}
                <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  method === 'card' 
                    ? 'border-violet-500 bg-violet-650/10 text-slate-100' 
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="card"
                    checked={method === 'card'}
                    onChange={() => setMethod('card')}
                    className="sr-only"
                  />
                  <span className="text-2xl">💳</span>
                  <span className="text-sm font-semibold">Credit/Debit Card</span>
                </label>

                {/* Wallet */}
                <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  method === 'wallet'
                    ? 'border-violet-500 bg-violet-650/10 text-slate-100'
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                } ${!canPayFullyWithWallet ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="wallet"
                    checked={method === 'wallet'}
                    disabled={!canPayFullyWithWallet}
                    onChange={() => setMethod('wallet')}
                    className="sr-only"
                  />
                  <span className="text-2xl">👛</span>
                  <span className="text-sm font-semibold">Wallet Balance</span>
                  <span className="text-[11px] text-slate-500">${walletBalance.toFixed(2)} available</span>
                </label>
              </div>

              {method !== 'wallet' && walletBalance > 0 && (
                <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={e => setUseWallet(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  Apply my wallet balance (${walletBalance.toFixed(2)}) toward this order first, pay the rest via {method === 'khqr' ? 'KHQR' : method}
                </label>
              )}
            </div>

            {/* Review Items */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-200">Review Items</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-semibold text-slate-350">{item.product.title}</span>
                      <span className="text-slate-500 ml-2">x{item.qty}</span>
                    </div>
                    <span className="font-mono text-slate-200">${(item.unit_price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Checkout billing column */}
          <div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-200">Billing Summary</h2>
              
              <div className="space-y-3 border-b border-slate-800 pb-4 mb-4 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax & Fees</span>
                  <span className="font-mono text-slate-200">$0.00</span>
                </div>
              </div>

              {(method === 'wallet' || useWallet) && (
                <div className="flex justify-between text-sm text-emerald-400 mb-2">
                  <span>Wallet applied</span>
                  <span className="font-mono">-${Math.min(walletBalance, total).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-semibold text-slate-100 mb-6">
                <span>{method === 'wallet' || useWallet ? 'Remaining Due' : 'Total Amount'}</span>
                <span className="font-mono text-violet-400 text-lg">
                  ${(method === 'wallet' || useWallet
                    ? Math.max(0, total - Math.min(walletBalance, total))
                    : total
                  ).toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-950/50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Placing Order…
                  </>
                ) : (
                  'Place Order & Pay'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}
