import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useCart } from '../context/CartContext'
import { getOrderPaymentStatus, cancelOrder } from '../api/endpoints'
import Container from '../components/layout/Container'

export default function PaymentKhqr() {
  const location = useLocation()
  const navigate = useNavigate()
  const { order, paymentDetails } = location.state || {}
  const { refreshCart } = useCart()

  const [status, setStatus] = useState('pending_payment')
  const [showSuccess, setShowSuccess] = useState(false)

  const getTimeLeft = () => {
    if (!order?.created_at) return 900
    const raw = order.created_at.endsWith('Z') ? order.created_at : order.created_at + 'Z'
    const expiresAt = new Date(raw).getTime() + 15 * 60 * 1000
    return Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
  }
  const [timeLeft, setTimeLeft] = useState(getTimeLeft)

  const timerRef = useRef(null)
  const pollRef = useRef(null)
  const isPaidRef = useRef(false)

  useEffect(() => {
    if (!order || !paymentDetails) navigate('/cart')
  }, [order, paymentDetails, navigate])

  useEffect(() => {
    if (!order) return
    setTimeLeft(getTimeLeft())
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          clearInterval(pollRef.current)
          setStatus('cancelled')
          if (!isPaidRef.current) {
            cancelOrder(order.id).then(() => refreshCart()).catch(() => {})
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [order, refreshCart])

  useEffect(() => {
    if (!order) return
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getOrderPaymentStatus(order.id)
        if (data.status === 'fulfilled' || data.status === 'paid') {
          isPaidRef.current = true
          clearInterval(timerRef.current)
          clearInterval(pollRef.current)
          refreshCart()
          setShowSuccess(true)
          setTimeout(() => {
            navigate('/order-success', { state: { orderId: order.id } })
          }, 2500)
        } else if (data.status === 'cancelled' || data.status === 'failed') {
          clearInterval(timerRef.current)
          clearInterval(pollRef.current)
          setStatus(data.status)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 3000)
    return () => clearInterval(pollRef.current)
  }, [order, navigate])

  const handleCancelAndGoBack = async () => {
    if (!order || isPaidRef.current) return
    clearInterval(timerRef.current)
    clearInterval(pollRef.current)
    try {
      await cancelOrder(order.id)
      refreshCart()
    } catch {}
    navigate('/cart')
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (!order || !paymentDetails) return null

  if (status === 'cancelled') {
    return (
      <Container>
        <div className="mx-auto max-w-md text-center py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-3xl">✕</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-100">Order Expired</h1>
          <p className="mb-6 text-sm text-slate-400">The QR code has expired and your stock reservation was released.</p>
          <button onClick={() => navigate('/cart')}
            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition">
            Back to Cart
          </button>
        </div>
      </Container>
    )
  }

  return (
    <>
      {/* Payment success popup overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="mx-4 w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-slate-900 p-8 text-center shadow-2xl shadow-emerald-950/50"
            style={{ animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>

            {/* Animated checkmark circle */}
            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              {/* Outer ring pulse */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-emerald-500/10" />
              {/* Inner circle */}
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500">
                <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                    style={{ animation: 'drawCheck 0.5s ease 0.3s forwards', strokeDasharray: 30, strokeDashoffset: 30 }} />
                </svg>
              </div>
            </div>

            <h2 className="mb-1 text-2xl font-bold text-emerald-400">Payment Successful!</h2>
            <p className="mb-4 text-sm text-slate-400">Your order has been confirmed and your items are ready.</p>

            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Order</span>
                <span className="font-mono font-semibold text-slate-200">{order.order_number}</span>
              </div>
              <div className="mt-1 flex justify-between text-slate-400">
                <span>Amount Paid</span>
                <span className="font-mono font-semibold text-emerald-400">${parseFloat(order.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <div className="h-1 w-1 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0ms' }} />
              <div className="h-1 w-1 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '150ms' }} />
              <div className="h-1 w-1 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '300ms' }} />
              <span className="ml-1">Redirecting to your items…</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <Container>
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <button onClick={handleCancelAndGoBack}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Cancel & Back to Cart
            </button>
          </div>

          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-slate-100">Scan to Pay</h1>
            <p className="mb-6 text-sm text-slate-400">Use ABA, ACLEDA, Wing, or any Bakong-connected bank app.</p>

            {/* KHQR Card */}
            <div className="relative mx-auto mb-6 w-[280px] rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl text-slate-900 select-none">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-blue-600 rounded-full px-3 py-1 font-bold text-white text-[10px] uppercase tracking-wider">
                  <span>KHQR</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span>Bakong</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instant Pay</span>
              </div>

              <div className="text-center mb-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">GM Store</h3>
                <p className="text-[9px] font-mono text-slate-400 mt-0.5">loum_vanchha@bkrt</p>
              </div>

              <div className="mx-auto p-2.5 bg-white border border-slate-100 rounded-2xl shadow-inner inline-block">
                <QRCodeSVG
                  value={paymentDetails.qr_string}
                  size={200}
                  level="H"
                  includeMargin={false}
                  imageSettings={{ src: "/bakong_logo.png", height: 38, width: 38, excavate: true }}
                />
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Amount Due</p>
                <p className="text-xl font-black font-mono text-blue-600 mt-1">
                  ${parseFloat(paymentDetails.amount).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              Waiting for payment confirmation…
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400 space-y-2">
              <div className="flex justify-between">
                <span>Order Number</span>
                <span className="font-semibold text-slate-200">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Due</span>
                <span className="font-mono font-semibold text-violet-400">${parseFloat(paymentDetails.amount).toFixed(2)}</span>
              </div>
              {order.wallet_amount > 0 && (
                <div className="flex justify-between">
                  <span>Wallet Applied</span>
                  <span className="font-mono font-semibold text-emerald-400">-${parseFloat(order.wallet_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>QR Expires In</span>
                <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-400' : 'text-amber-400'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}
