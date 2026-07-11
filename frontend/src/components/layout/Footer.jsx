import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <span className="text-lg font-bold text-violet-400 tracking-tight">GM Store</span>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Instant delivery of game accounts and keys from verified inventory.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Shop</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/best-sale" className="hover:text-slate-200 transition">Best Sale</Link></li>
              <li><Link to="/coming-soon" className="hover:text-slate-200 transition">Coming Soon</Link></li>
              <li><Link to="/sold-out" className="hover:text-slate-200 transition">Sold Out</Link></li>
              <li><Link to="/search" className="hover:text-slate-200 transition">Search</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Account</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/account/profile" className="hover:text-slate-200 transition">Profile</Link></li>
              <li><Link to="/account/history" className="hover:text-slate-200 transition">Purchase History</Link></li>
              <li><Link to="/account/favorites" className="hover:text-slate-200 transition">Favorites</Link></li>
              <li><Link to="/account/preorders" className="hover:text-slate-200 transition">Pre-orders</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Support</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/contact" className="hover:text-slate-200 transition">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} GM Store. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
