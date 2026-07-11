import { useState, useEffect } from 'react'
import { getUserFavorites, removeFavorite } from '../../api/endpoints'
import ProductCard from '../../components/product/ProductCard'
import AccountLayout from './AccountLayout'

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchFavorites()
  }, [])

  const fetchFavorites = () => {
    getUserFavorites()
      .then(({ data }) => setFavorites(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }

  const handleRemove = async (e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await removeFavorite(productId)
      setFavorites(favorites.filter((fav) => fav.product_id !== productId))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove favorite.')
    }
  }

  return (
    <AccountLayout>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Wishlist / Favorites</h2>
        <span className="rounded-full bg-violet-600/20 px-3 py-1 text-xs font-semibold text-violet-400">
          {favorites.length} {favorites.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex py-12 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      ) : favorites.length === 0 ? (
        <div className="py-12 text-center">
          <div className="flex justify-center mb-3">
            <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-slate-300">Your wishlist is empty</h3>
          <p className="text-sm text-slate-500">Explore products and click the heart icon to save them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => {
            if (!fav.product) return null
            return (
              <div key={fav.id} className="relative group">
                <ProductCard product={fav.product} />
                <button
                  onClick={(e) => handleRemove(e, fav.product_id)}
                  className="absolute top-2 right-2 rounded-full bg-slate-900/80 p-2 text-red-400 hover:text-red-300 hover:bg-slate-950 shadow-md transition"
                  title="Remove from favorites"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </AccountLayout>
  )
}
