import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

export default function VerifyOtp() {
  const { verifyOtp, resendOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const debugOtp = location.state?.debugOtp || ''

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [verifySuccess, setVerifySuccess] = useState(false)
  const refs = useRef([])

  useEffect(() => {
    if (debugOtp && debugOtp.length === 6) {
      setDigits(debugOtp.split(''))
    }
  }, [debugOtp])

  const code = digits.join('')

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) setDigits(text.split(''))
    e.preventDefault()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter all 6 digits.'); return }
    setError('')
    setLoading(true)
    try {
      await verifyOtp(email, code)
      setVerifySuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 1600)
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendMsg('')
    try {
      const data = await resendOtp(email)
      setResendMsg(data.message)
      if (data.debug_otp && data.debug_otp.length === 6) {
        setDigits(data.debug_otp.split(''))
      }
    } catch (err) {
      setResendMsg(err.response?.data?.error || 'Could not resend.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-950 auth-glow-container animate-fade-in">
      {/* Background glow effects */}
      <div className="auth-glow-bubble-1" />
      <div className="auth-glow-bubble-2" />

      {/* Success Confirmed Animation Overlay */}
      {verifySuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="success-checkmark mb-4">
            <svg viewBox="0 0 52 52" className="h-full w-full">
              <circle cx="26" cy="26" r="25" className="success-checkmark-circle" />
              <path d="M14.1 27.2l7.1 7.2 16.7-16.8" className="success-checkmark-check" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight animate-fade-in">Verification Successful</h2>
          <p className="text-xs text-slate-500 mt-1 animate-fade-in">Logging you in automatically...</p>
        </div>
      )}

      <div className="w-full max-w-md rounded-3xl border border-slate-900 bg-slate-900/35 p-8 shadow-2xl backdrop-blur-md animate-card-entrance text-center">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mb-2">Check Email</h1>
        <p className="text-sm text-slate-500 mb-6">
          We sent a 6-digit code to <span className="text-slate-300 font-semibold">{email}</span>
        </p>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-400 text-left">
            {error}
          </div>
        )}
        
        {resendMsg && (
          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 text-xs text-slate-300 text-left">
            {resendMsg}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="mb-6 flex justify-center gap-3" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
                className="h-12 w-11 rounded-xl border border-slate-700 bg-slate-800/50 text-center text-lg font-bold text-slate-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            ))}
          </div>
          <Button type="submit" loading={loading} className="w-full sheen-btn bg-violet-600 hover:bg-violet-500 font-semibold">
            Verify Code
          </Button>
        </form>

        <button onClick={handleResend} className="mt-5 text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium">
          Didn't get the code? <span className="text-violet-455 hover:underline">Resend code</span>
        </button>
      </div>
    </div>
  )
}
