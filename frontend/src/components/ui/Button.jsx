export default function Button({ children, loading = false, variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50'
  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700',
    ghost: 'text-slate-400 hover:text-slate-200',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : children}
    </button>
  )
}
