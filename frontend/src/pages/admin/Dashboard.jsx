import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import AdminLayout from './AdminLayout'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Interactive chart tooltip state
  const [hoveredPoint, setHoveredPoint] = useState(null)

  useEffect(() => {
    client.get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <LoadingSpinner />
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      </AdminLayout>
    )
  }

  // --- SVG Revenue Chart Math ---
  const dailySales = stats?.daily_sales || []
  const maxRevenue = Math.max(...dailySales.map(d => d.revenue), 100)
  const svgWidth = 540
  const svgHeight = 220
  const paddingX = 45
  const paddingY = 30
  const chartWidth = svgWidth - paddingX * 2
  const chartHeight = svgHeight - paddingY * 2

  const points = dailySales.map((d, index) => {
    const x = paddingX + (index * (chartWidth / (dailySales.length - 1)))
    const y = svgHeight - paddingY - ((d.revenue / maxRevenue) * chartHeight)
    return { x, y, day: d.day, revenue: d.revenue, index }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(svgHeight - paddingY).toFixed(1)} L ${points[0].x.toFixed(1)} ${(svgHeight - paddingY).toFixed(1)} Z` : ''

  // Category Distribution share total
  const catDistribution = stats?.category_distribution || []
  const totalCatCount = catDistribution.reduce((acc, c) => acc + c.value, 0) || 1

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Overview Stats</h1>
          <p className="text-xs text-slate-500 mt-1">Realtime catalog performance and checkout revenue</p>
        </div>
        <Link
          to="/admin/products/new"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-all sheen-btn shadow-md shadow-emerald-950/20"
        >
          + Add Product
        </Link>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 shadow-lg premium-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Total Revenue</p>
          <p className="font-mono text-2xl font-bold text-emerald-450">${stats.sales_total.toFixed(2)}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 shadow-lg premium-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Fulfilled Orders</p>
          <p className="text-2xl font-bold text-slate-150">{stats.orders_count}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 shadow-lg premium-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Catalog Products</p>
          <p className="text-2xl font-bold text-slate-155">{stats.products_count}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 shadow-lg premium-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Registered Users</p>
          <p className="text-2xl font-bold text-slate-160">{stats.users_count}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Sales Trend SVG Area Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5 shadow-md relative">
          <div className="mb-4">
            <h2 className="text-md font-semibold text-slate-200">Revenue Trend (Last 7 Days)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Scanned payments daily trend</p>
          </div>

          <div className="w-full flex justify-center items-center">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} className="stroke-slate-800/40 stroke-1 stroke-dasharray-[4,4]" />
              <line x1={paddingX} y1={paddingY + chartHeight / 2} x2={svgWidth - paddingX} y2={paddingY + chartHeight / 2} className="stroke-slate-800/40 stroke-1 stroke-dasharray-[4,4]" />
              <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} className="stroke-slate-800/70 stroke-1" />

              {/* Chart Line and Area */}
              {points.length > 0 && (
                <>
                  <path d={areaPath} fill="url(#salesGrad)" />
                  <path d={linePath} fill="none" className="stroke-violet-500 stroke-[3] stroke-linejoin-round" />
                </>
              )}

              {/* Markers & Tooltips triggers */}
              {points.map((p) => (
                <g key={p.index}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.index === p.index ? 6 : 4}
                    className="fill-violet-500 stroke-slate-950 stroke-2 cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* X Axis Labels */}
                  <text
                    x={p.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px] font-semibold"
                  >
                    {p.day}
                  </text>
                </g>
              ))}

              {/* Y Axis Labels */}
              <text x={10} y={paddingY + 4} className="fill-slate-500 text-[9px] font-mono font-bold">${maxRevenue.toFixed(0)}</text>
              <text x={10} y={paddingY + chartHeight / 2 + 4} className="fill-slate-500 text-[9px] font-mono font-bold">${(maxRevenue / 2).toFixed(0)}</text>
              <text x={10} y={svgHeight - paddingY + 4} className="fill-slate-500 text-[9px] font-mono font-bold">$0</text>
            </svg>
          </div>

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute pointer-events-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 shadow-xl text-center text-xs animate-fade-in"
              style={{
                left: `${(hoveredPoint.x / svgWidth) * 90 + 5}%`,
                top: `${(hoveredPoint.y / svgHeight) * 50 + 20}%`
              }}
            >
              <p className="font-semibold text-slate-400">{hoveredPoint.day} Earnings</p>
              <p className="font-mono text-emerald-400 font-bold mt-0.5">${hoveredPoint.revenue.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Category Share Donut / Progress Bars */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5 shadow-md">
          <div className="mb-4">
            <h2 className="text-md font-semibold text-slate-200">Catalog Share by Category</h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribution of taxonomy categories</p>
          </div>

          <div className="space-y-4 py-2">
            {catDistribution.map((cat, i) => {
              const pct = ((cat.value / totalCatCount) * 100).toFixed(0)
              const colors = ['bg-violet-600', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500']
              const color = colors[i % colors.length]
              
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      {cat.name}
                    </span>
                    <span className="text-slate-400">{cat.value} items ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-1000`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between border-b border-slate-850 pb-3">
            <h2 className="text-md font-semibold text-slate-200 flex items-center gap-2">
              <svg className="h-4.5 w-4.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Low Stock Alerts</span>
            </h2>
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-400 animate-pulse">
              {stats.low_stock_products.length} warnings
            </span>
          </div>

          {stats.low_stock_products.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">All products have sufficient stock levels.</p>
          ) : (
            <div className="divide-y divide-slate-850 space-y-3.5">
              {stats.low_stock_products.map((prod) => (
                <div key={prod.id} className="flex items-center justify-between pt-3.5 first:pt-0">
                  <div>
                    <Link to={`/products/${prod.slug}`} className="text-sm font-semibold text-slate-200 hover:text-emerald-450 transition-colors">
                      {prod.title}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">${prod.price.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                      prod.available_stock === 0 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {prod.available_stock} left
                    </span>
                    <div className="mt-1">
                      <Link
                        to={`/admin/products/${prod.id}/stock`}
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        + Add Stock
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Sellers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5 shadow-md">
          <div className="mb-4 border-b border-slate-850 pb-3">
            <h2 className="text-md font-semibold text-slate-200 flex items-center gap-2">
              <svg className="h-4.5 w-4.5 text-emerald-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
              <span>Best Selling Products</span>
            </h2>
          </div>

          {stats.top_products.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No items have been sold yet.</p>
          ) : (
            <div className="divide-y divide-slate-850 space-y-3.5">
              {stats.top_products.map((prod, index) => (
                <div key={prod.id} className="flex items-center justify-between pt-3.5 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-slate-500">#0{index + 1}</span>
                    <div>
                      <Link to={`/products/${prod.slug}`} className="text-sm font-semibold text-slate-200 hover:text-emerald-450 transition-colors">
                        {prod.title}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">${prod.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    {prod.sold_count} sold
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
