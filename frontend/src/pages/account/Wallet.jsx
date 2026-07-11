import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import AccountLayout from './AccountLayout'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { getWallet, createWalletTopup, getWalletTopupStatus } from '../../api/endpoints'
import { useToast } from '../../context/ToastContext'

const TYPE_LABELS = {
  topup: 'Top Up',
  purchase: 'Purchase',
  refund: 'Refund',
  admin_credit: 'Admin Credit',
  admin_debit: 'Admin Debit',
}

function TopupModal({ onClose, onSuccess }) {
  const toast = useToast()
  const [amount, setAmount] = useState('10')
  const [step, setStep] = useState('form') // form | qr
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  const startTopup = async () => {
    setError(null)
    const amt = parseFloat(amount)
    if (!amt || amt < 1) {
      setError('Enter an amount of at least $1.00.')
      return
    }
    setLoading(true)
    try {
      const { data } = await createWalletTopup(amt)
      setQr(data)
      setStep('qr')
      pollRef.current = setInterval(async () => {
        try {
          const { data: s } = await getWalletTopupStatus(data.topup_id)
          if (s.status === 'success') {
            clearInterval(pollRef.current)
            toast('Wallet topped up successfully.', 'success')
            onSuccess()
          } else if (s.status === 'cancelled' || s.status === 'expired') {
            clearInterval(pollRef.current)
            setError('This top-up expired. Start a new one.')
            setStep('form')
          }
        } catch {}
      }, 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create top-up.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        {step === 'form' ? (
          <>
            <h2 className="text-sm font-bold text-slate-100">Top Up Wallet</h2>
            <p className="mt-1 text-xs text-slate-500">Add funds via Bakong KHQR.</p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Amount (USD)</label>
              <input
                type="number"
                min="1"
                max="1000"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 transition">
                Cancel
              </button>
              <button onClick={startTopup} disabled={loading} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50">
                {loading ? 'Generating…' : 'Generate QR'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <h2 className="text-sm font-bold text-slate-100">Scan to Top Up</h2>
            <p className="mt-1 mb-4 text-xs text-slate-500">${parseFloat(amount).toFixed(2)} USD</p>
            <div className="mx-auto mb-4 w-fit rounded-2xl border border-slate-200 bg-white p-3">
              <QRCodeSVG value={qr.qr_string} size={180} level="H" includeMargin={false} />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-4">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              Waiting for payment…
            </div>
            <button onClick={onClose} className="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 transition">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Wallet() {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTopup, setShowTopup] = useState(false)

  const load = () => {
    setLoading(true)
    getWallet()
      .then(({ data }) => {
        setWallet(data.wallet)
        setTransactions(data.transactions)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <AccountLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">My Wallet</h1>
        <button
          onClick={() => setShowTopup(true)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition"
        >
          + Top Up
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Balance</p>
            <p className="mt-1 font-mono text-3xl font-black text-violet-400">
              ${wallet ? parseFloat(wallet.balance).toFixed(2) : '0.00'}
            </p>
          </div>

          <h2 className="mb-3 text-sm font-bold text-slate-200">Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No wallet activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-200">{TYPE_LABELS[t.type] || t.type}</span>
                    {t.reference && <span className="ml-2 text-xs text-slate-500">{t.reference}</span>}
                    <div className="text-[11px] text-slate-500">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`font-mono font-bold ${t.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.amount >= 0 ? '+' : ''}{t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showTopup && (
        <TopupModal
          onClose={() => setShowTopup(false)}
          onSuccess={() => { setShowTopup(false); load() }}
        />
      )}
    </AccountLayout>
  )
}
