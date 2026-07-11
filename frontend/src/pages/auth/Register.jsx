import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)

  const [showGoogleSim, setShowGoogleSim] = useState(false)
  const [customGoogleEmail, setCustomGoogleEmail] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const e2 = {}
    if (!form.full_name.trim()) e2.full_name = 'Name is required.'
    if (!form.email.includes('@')) e2.email = 'Enter a valid email address.'
    if (form.password.length < 8) e2.password = 'Password must be at least 8 characters.'
    if (Object.keys(e2).length) { setErrors(e2); return }
    setErrors({})
    setApiError('')
    setLoading(true)
    try {
      const res = await register(form.email, form.password, form.full_name)
      navigate('/verify-otp', { state: { email: form.email, debugOtp: res.debug_otp } })
    } catch (err) {
      setApiError(err.response?.data?.error || 'Registration failed.')
      setLoading(false)
    }
  }

  const handleGoogleCredentialResponse = async (response) => {
    setApiError('')
    setLoading(true)
    try {
      await loginWithGoogle(response.credential)
      setLoginSuccess(true)
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 1600)
    } catch (err) {
      setApiError(err.response?.data?.error || 'Google registration failed.')
      setLoading(false)
    }
  }

  const handleGoogleSandboxLogin = async (email, name) => {
    setApiError('')
    setShowGoogleSim(false)
    setLoading(true)
    try {
      const sandboxToken = `sandbox:${email}:${name}`
      await loginWithGoogle(sandboxToken)
      setLoginSuccess(true)
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 1600)
    } catch (err) {
      setApiError(err.response?.data?.error || 'Google sandbox login failed.')
      setLoading(false)
    }
  }

  useEffect(() => {
    let timer
    const initGoogle = () => {
      if (window.google) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "your-google-client-id.apps.googleusercontent.com"
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        })
        const btnContainer = document.getElementById("google-signup-btn")
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "signup_with",
            shape: "pill"
          })
        }
      } else {
        timer = setTimeout(initGoogle, 100)
      }
    }
    initGoogle()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-950 auth-glow-container animate-fade-in">
      {/* Background glow effects */}
      <div className="auth-glow-bubble-1" />
      <div className="auth-glow-bubble-2" />
      
      {/* Success Confirmed Animation Overlay */}
      {loginSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="success-checkmark mb-4">
            <svg viewBox="0 0 52 52" className="h-full w-full">
              <circle cx="26" cy="26" r="25" className="success-checkmark-circle" />
              <path d="M14.1 27.2l7.1 7.2 16.7-16.8" className="success-checkmark-check" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight animate-fade-in">Registration Successful</h2>
          <p className="text-xs text-slate-500 mt-1 animate-fade-in">Preparing your dashboard...</p>
        </div>
      )}

      {/* Google Sandbox Selector Modal */}
      {showGoogleSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md animate-fade-in px-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-card-entrance">
            <div className="text-center mb-5">
              <svg className="h-10 w-10 mx-auto mb-2" viewBox="0 0 24 24">
                <path fill="#ea4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.74 14.93 1 12 1 7.35 1 3.4 3.65 1.48 7.5l3.84 3C6.27 7.5 8.91 5.04 12 5.04z" />
                <path fill="#4285f4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.75-4.87 3.75-8.54z" />
                <path fill="#fbbc05" d="M5.32 10.5A6.98 6.98 0 015 12c0 .52.08 1.03.22 1.53l-3.84 3A11.96 11.96 0 011 12c0-1.89.44-3.67 1.22-5.26l3.1 3.76z" />
                <path fill="#34a853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.31 1.09-3.9 1.09-3.09 0-5.73-2.46-6.66-5.46l-3.84 3C3.4 20.35 7.35 23 12 23z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-100">Sandbox Google Account</h3>
              <p className="text-xs text-slate-500 mt-1">Select a preconfigured local user account</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleGoogleSandboxLogin('google_tester@gmail.com', 'Google Tester')}
                className="flex items-center gap-3 w-full p-3 rounded-xl border border-slate-800 bg-slate-850 hover:bg-slate-800 transition text-left cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white uppercase select-none">GT</div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Google Tester</p>
                  <p className="text-[10px] text-slate-500">google_tester@gmail.com</p>
                </div>
              </button>

              <button
                onClick={() => handleGoogleSandboxLogin('google_admin@gmail.com', 'Google Admin')}
                className="flex items-center gap-3 w-full p-3 rounded-xl border border-slate-800 bg-slate-850 hover:bg-slate-800 transition text-left cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white uppercase select-none">GA</div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Google Admin</p>
                  <p className="text-[10px] text-slate-500 font-mono">google_admin@gmail.com</p>
                </div>
              </button>

              <div className="border-t border-slate-800 my-2 pt-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Or use another email</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    className="w-full text-xs font-mono rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-slate-100 outline-none"
                  />
                  <button
                    disabled={!customGoogleEmail.includes('@')}
                    onClick={() => handleGoogleSandboxLogin(customGoogleEmail, customGoogleEmail.split('@')[0])}
                    className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50 cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGoogleSim(false)}
              className="w-full mt-4 text-center text-xs text-slate-500 hover:text-slate-400 font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md rounded-3xl border border-slate-900 bg-slate-900/35 p-8 shadow-2xl backdrop-blur-md animate-card-entrance">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Create Account</h1>
          <p className="mt-2 text-sm text-slate-500">Join GM Store to buy game accounts & keys</p>
        </div>

        {apiError && (
          <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-400">
            {apiError}
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-5">
          <Input 
            label="Full Name" 
            placeholder="Your name" 
            value={form.full_name} 
            onChange={set('full_name')} 
            error={errors.full_name} 
          />
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="you@example.com" 
            value={form.email} 
            onChange={set('email')} 
            error={errors.email} 
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="Min 8 characters" 
            value={form.password} 
            onChange={set('password')} 
            error={errors.password} 
          />

          <Button type="submit" loading={loading} className="w-full sheen-btn bg-violet-600 hover:bg-violet-500 mt-2 font-semibold">
            Register Account
          </Button>
        </form>

        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800/60"></div>
          </div>
          <span className="relative bg-slate-900/60 px-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Or continue with</span>
        </div>

        {/* Real Native Google Sign-In SDK Button Container */}
        <div className="flex flex-col items-center justify-center w-full gap-2">
          <div className="flex justify-center w-full min-h-[46px]">
            <div id="google-signup-btn" />
          </div>
          
          {/* Developer Sandbox Bypass link */}
          <button
            type="button"
            onClick={() => setShowGoogleSim(true)}
            className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold transition hover:underline mt-1 cursor-pointer"
          >
            Google Client error? Click here for Sandbox Sign-in
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-455 hover:underline font-semibold transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
