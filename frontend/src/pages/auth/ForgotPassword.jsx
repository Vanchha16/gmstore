import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ code: '', new_password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState('')
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  const submitEmail = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) { setErrors({ email: 'Enter a valid email.' }); return }
    setErrors({})
    setLoading(true)
    try {
      const data = await forgotPassword(email)
      setMsg(data.message)
      setStep('reset')
    } catch {
      setMsg('If that email is registered you will receive a reset code.')
      setStep('reset')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submitReset = async (e) => {
    e.preventDefault()
    const e2 = {}
    if (!form.code.trim()) e2.code = 'Enter your code.'
    if (form.new_password.length < 8) e2.new_password = 'At least 8 characters.'
    if (form.new_password !== form.confirm) e2.confirm = 'Passwords do not match.'
    if (Object.keys(e2).length) { setErrors(e2); return }
    setErrors({})
    setApiError('')
    setLoading(true)
    try {
      await resetPassword(email, form.code, form.new_password)
      navigate('/login')
    } catch (err) {
      setApiError(err.response?.data?.error || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-100">Reset password</h1>

        {step === 'email' ? (
          <>
            <p className="mb-6 text-sm text-slate-500">Enter your email and we'll send a reset code.</p>
            <form onSubmit={submitEmail} className="flex flex-col gap-4">
              <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
              <Button type="submit" loading={loading} className="w-full">Send code</Button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-300">{msg}</p>
            {apiError && <p className="mb-4 rounded-xl bg-red-900/30 px-4 py-3 text-sm text-red-400">{apiError}</p>}
            <form onSubmit={submitReset} className="flex flex-col gap-4">
              <Input label="6-digit code" placeholder="123456" value={form.code} onChange={set('code')} error={errors.code} />
              <Input label="New password" type="password" placeholder="8+ characters" value={form.new_password} onChange={set('new_password')} error={errors.new_password} />
              <Input label="Confirm password" type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
              <Button type="submit" loading={loading} className="w-full">Reset password</Button>
            </form>
          </>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link to="/login" className="text-violet-400 hover:text-violet-300">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
