import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { getProducts, getWallet } from '../../api/endpoints'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { cartCount } = useCart()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [walletBalance, setWalletBalance] = useState(null)

  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!user) { setWalletBalance(null); return }
    getWallet().then(({ data }) => setWalletBalance(parseFloat(data.wallet.balance))).catch(() => {})
  }, [user])

  const navLink = ({ isActive }) =>
    `text-sm transition ${isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'}`

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const delayDebounceFn = setTimeout(() => {
      getProducts({ q: searchQuery, limit: 6 })
        .then(({ data }) => {
          setResults(data.items || [])
        })
        .catch(err => console.error(err))
        .finally(() => setSearchLoading(false))
    }, 250)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const handleResultClick = (slug) => {
    setSearchQuery('')
    setShowDropdown(false)
    navigate(`/products/${slug}`)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-lg font-bold text-violet-400 tracking-tight flex-shrink-0">GM Store</Link>

        {/* Live Search Bar Component */}
        <div ref={dropdownRef} className="relative flex-1 max-w-md mx-4 hidden sm:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Search games, keys, accounts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) { setShowDropdown(false); navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`) } }}
              className="w-full text-xs rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 pl-9 text-slate-200 placeholder:text-slate-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition"
            />
            <svg className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchLoading && (
              <div className="absolute right-3.5 top-2.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-700 border-t-violet-400" />
            )}
          </div>

          {/* Autocomplete suggestion pane */}
          {showDropdown && searchQuery && (
            <div className="absolute left-0 right-0 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md animate-card-entrance">
              {searchLoading && results.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">Searching inventory...</p>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {results.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleResultClick(product.slug)}
                      className="flex items-center gap-3 w-full p-2 rounded-xl text-left hover:bg-slate-800/80 transition cursor-pointer"
                    >
                      <div className="h-10 w-8 flex-shrink-0 overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                        {product.images?.[0] ? (
                          <img src={product.images[0].url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-slate-900" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{product.title}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                          {product.category?.name || product.product_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-violet-400">
                          {product.currency || '$'}{product.price.toFixed(2)}
                        </p>
                        <p className={`text-[9px] font-semibold ${product.is_available ? 'text-emerald-400' : 'text-red-400'}`}>
                          {product.is_available ? 'Available' : 'Not Available'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-center text-xs text-slate-500">No matching titles found.</p>
              )}
              {results.length > 0 && (
                <button onClick={() => { setShowDropdown(false); navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`) }}
                  className="mt-1 w-full rounded-xl py-2 text-center text-xs text-violet-400 hover:bg-slate-800/60 transition">
                  View all results →
                </button>
              )}
            </div>
          )}
        </div>

        <nav className="hidden items-center gap-5 md:flex">
          <NavLink to="/best-sale" className={navLink}>Best Sale</NavLink>
          <NavLink to="/coming-soon" className={navLink}>Coming Soon</NavLink>
          <NavLink to="/sold-out" className={navLink}>Sold Out</NavLink>
          <NavLink to="/contact" className={navLink}>Contact</NavLink>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.role === 'admin' && (
                <NavLink to="/admin/dashboard" className="hidden md:block text-xs text-emerald-400 hover:text-emerald-300">Admin</NavLink>
              )}
              <Link to="/account/wallet" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Wallet</span>
                {walletBalance !== null && (
                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold font-mono text-white leading-none">
                    ${walletBalance.toFixed(2)}
                  </span>
                )}
              </Link>
              <Link to="/cart" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 mr-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="hidden sm:inline">Cart</span>
                {cartCount > 0 && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold font-mono text-white leading-none">{cartCount}</span>}
              </Link>
              <Link to="/account/profile" className="hidden md:flex text-xs text-violet-400 hover:text-violet-300 items-center gap-1.5 font-medium">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{user.full_name}</span>
              </Link>
              <button onClick={handleLogout} className="hidden md:block text-sm text-slate-400 hover:text-slate-200 cursor-pointer">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden md:block text-sm text-slate-400 hover:text-slate-200">Sign in</Link>
              <Link to="/register" className="hidden md:block rounded-xl bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-500 transition">Sign up</Link>
            </>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden rounded-lg p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 px-4 py-4 flex flex-col gap-1">
          {[
            { to: '/best-sale', label: 'Best Sale' },
            { to: '/coming-soon', label: 'Coming Soon' },
            { to: '/sold-out', label: 'Sold Out' },
            { to: '/contact', label: 'Contact' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `rounded-xl px-4 py-2.5 text-sm font-medium transition ${isActive ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              {label}
            </NavLink>
          ))}

          <div className="my-2 border-t border-slate-800" />

          {user ? (
            <>
              {user.role === 'admin' && (
                <NavLink to="/admin/dashboard" onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-slate-800 transition">
                  Admin Panel
                </NavLink>
              )}
              <NavLink to="/account/wallet" onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition">
                <span>Wallet</span>
                {walletBalance !== null && <span className="font-mono text-emerald-400">${walletBalance.toFixed(2)}</span>}
              </NavLink>
              <NavLink to="/account/profile" onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition">
                {user.full_name}
              </NavLink>
              <button onClick={() => { setMobileOpen(false); handleLogout() }}
                className="rounded-xl px-4 py-2.5 text-left text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition">
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition">
                Sign in
              </NavLink>
              <NavLink to="/register" onClick={() => setMobileOpen(false)}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-violet-500 transition">
                Sign up
              </NavLink>
            </>
          )}
        </div>
      )}
    </header>
  )
}
