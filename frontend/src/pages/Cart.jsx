import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import Container from '../components/layout/Container'

export default function Cart() {
  const { cart, loading, error, updateQty, removeFromCart } = useCart()
  const navigate = useNavigate()
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const handleQtyChange = async (itemId, currentQty, amount) => {
    const target = currentQty + amount
    if (target <= 0) return
    try {
      await updateQty(itemId, target)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRemove = async (itemId) => {
    try {
      await removeFromCart(itemId)
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading && !cart) {
    return (
      <Container>
        <div className="flex py-24 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      </Container>
    )
  }

  const items = cart?.items || []
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const total = subtotal // Promo placeholder

  return (
    <Container>
      <h1 className="mb-8 text-3xl font-bold text-slate-100">Shopping Cart</h1>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 py-16 text-center">
          <div className="flex justify-center mb-4">
            <svg className="h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-300">Your cart is empty</h2>
          <p className="mb-6 text-sm text-slate-500">Add games or accounts to start your journey.</p>
          <Link
            to="/"
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const product = item.product
              if (!product) return null
              const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0]

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {/* Image */}
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                      {primaryImage ? (
                        <img src={primaryImage.url} alt={item.title_snapshot} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-700 text-xs">No Img</div>
                      )}
                    </div>
                    <div>
                      <Link to={`/products/${product.slug}`} className="font-semibold text-slate-200 hover:text-violet-400 transition-colors">
                        {product.title}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{product.product_type}</p>
                      <div className="mt-1 font-mono text-sm text-slate-400">
                        ${floatToString(item.unit_price)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-6 sm:justify-end">
                    {/* Quantity Controls */}
                    <div className="flex items-center rounded-xl border border-slate-855 bg-slate-950 px-2 py-1">
                      <button
                        onClick={() => handleQtyChange(item.id, item.qty, -1)}
                        className="px-2 text-slate-400 hover:text-slate-200"
                        disabled={item.qty <= 1}
                      >
                        -
                      </button>
                      <span className="px-3 font-mono text-sm text-slate-200">{item.qty}</span>
                      <button
                        onClick={() => handleQtyChange(item.id, item.qty, 1)}
                        className="px-2 text-slate-400 hover:text-slate-200"
                      >
                        +
                      </button>
                    </div>

                    {/* Total Price */}
                    <div className="w-20 text-right font-mono font-semibold text-slate-200">
                      ${(item.unit_price * item.qty).toFixed(2)}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove item"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Cart Summary */}
          <div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-200">Order Summary</h2>
              
              <div className="space-y-3 border-b border-slate-800 pb-4 mb-4 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-$0.00</span>
                </div>
              </div>

              <div className="flex justify-between font-semibold text-slate-100 mb-6">
                <span>Total</span>
                <span className="font-mono text-violet-400 text-lg">${total.toFixed(2)}</span>
              </div>

              <button
                onClick={() => {
                  const itemsWithRules = items.filter(item => item.product?.rules)
                  if (itemsWithRules.length > 0) {
                    setShowRulesModal(true)
                  } else {
                    navigate('/checkout')
                  }
                }}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-950/50"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Product Rules & Terms</h3>
                <p className="text-xs text-slate-500">Please review and agree to proceed</p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-4 pr-1 mb-6 text-sm text-slate-400">
              {items.filter(item => item.product?.rules).map(item => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                  <h4 className="font-semibold text-slate-200 mb-1.5">{item.product.title} Rules:</h4>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{item.product.rules}</p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3 mb-6">
              <input
                id="agree-rules"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="agree-rules" className="text-xs text-slate-400 leading-normal cursor-pointer select-none">
                I have read, understood, and agree to the rules and terms for the account products in my cart.
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRulesModal(false); setAgreed(false) }}
                className="flex-1 rounded-xl border border-slate-800 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition"
              >
                Cancel
              </button>
              <button
                disabled={!agreed}
                onClick={() => {
                  setShowRulesModal(false)
                  navigate('/checkout')
                }}
                className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Agree & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

function floatToString(num) {
  return typeof num === 'number' ? num.toFixed(2) : parseFloat(num).toFixed(2)
}
