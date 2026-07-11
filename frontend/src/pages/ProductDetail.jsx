import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { getProduct, addFavorite, removeFavorite, getUserFavorites, addPreorder, getProductReviews, addProductReview } from '../api/endpoints'
import StatusBadge from '../components/product/StatusBadge'
import TypeBadge from '../components/product/TypeBadge'
import PriceTag from '../components/product/PriceTag'
import Container from '../components/layout/Container'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'

const MAX_ON_DEMAND_QTY = 10 // keep in sync with backend blueprints/cart.py

function RulesSection({ rules }) {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/10">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/30 text-sm font-semibold text-slate-300">
        <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Product Rules & Terms
      </div>
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm text-slate-400 leading-relaxed">{rules}</p>
      </div>
    </div>
  )
}

function RatingInput({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`transition-colors cursor-pointer ${(hover || value) >= star ? 'text-amber-400' : 'text-slate-700'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function ProductDetail() {
  const { slug } = useParams()
  const { user } = useAuth()
  const { addToCart } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImg, setActiveImg] = useState(0)

  const [qty, setQty] = useState(1)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [preordering, setPreordering] = useState(false)
  
  // Reviews state
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [ratingInput, setRatingInput] = useState(5)
  const [commentInput, setCommentInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [msg] = useState(null)

  const loadReviews = (prodId) => {
    setLoadingReviews(true)
    getProductReviews(prodId)
      .then(({ data }) => setReviews(data.items || []))
      .catch(console.error)
      .finally(() => setLoadingReviews(false))
  }

  useEffect(() => {
    getProduct(slug)
      .then(({ data }) => {
        setProduct(data)
        setActiveImg(0)
        loadReviews(data.id)
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [slug])

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    setReviewError('')
    setSubmitting(true)
    try {
      await addProductReview(product.id, { rating: ratingInput, comment: commentInput })
      setReviewSuccess(true)
      toast('Review submitted successfully!', 'success')
      loadReviews(product.id)
      getProduct(slug)
        .then(({ data }) => setProduct(data))
        .catch(console.error)
    } catch (err) {
      setReviewError(err.response?.data?.error || err.message || 'Failed to submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (product && location.hash === '#write-review') {
      setTimeout(() => {
        const el = document.getElementById('write-review')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }, [product, location.hash])

  // Check if product is favorited on load
  useEffect(() => {
    if (user && product) {
      getUserFavorites()
        .then(({ data }) => {
          setIsFavorited(data.some((f) => f.product_id === product.id))
        })
        .catch(console.error)
    }
  }, [user, product])

  const handleAddToCart = async () => {
    if (!user) { navigate('/login'); return }
    setAdding(true)
    try {
      await addToCart(product.id, qty)
      toast(`${qty} item${qty > 1 ? 's' : ''} added to cart!`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  const handlePreorder = async () => {
    if (!user) { navigate('/login'); return }
    setPreordering(true)
    try {
      await addPreorder(product.id)
      toast('Pre-order placed! We\'ll notify you when it\'s available.', 'success')
    } catch (err) {
      toast(err.response?.data?.error || err.message, 'error')
    } finally {
      setPreordering(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    setFavLoading(true)
    try {
      if (isFavorited) {
        await removeFavorite(product.id)
        setIsFavorited(false)
        toast('Removed from favorites', 'info')
      } else {
        await addFavorite(product.id)
        setIsFavorited(true)
        toast('Added to favorites', 'success')
      }
    } catch (err) {
      toast(err.response?.data?.error || err.message, 'error')
    } finally {
      setFavLoading(false)
    }
  }

  if (loading) {
    return (
      <Container>
        <div className="animate-pulse space-y-4">
          <div className="aspect-[16/9] rounded-2xl bg-slate-800" />
          <div className="h-8 w-1/2 rounded bg-slate-800" />
          <div className="h-4 w-1/4 rounded bg-slate-800" />
        </div>
      </Container>
    )
  }

  if (!product) {
    return (
      <Container>
        <p className="text-center text-slate-500">Product not found.</p>
        <div className="mt-4 text-center"><Link to="/" className="text-violet-400">← Back to store</Link></div>
      </Container>
    )
  }

  const images = product.images || []
  const currentImg = images[activeImg]

  return (
    <Container>
      <div className="grid gap-10 lg:grid-cols-2">
        {/* Images */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 aspect-[4/3]">
            {currentImg ? (
              <img src={currentImg.url} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-700 text-sm">No image</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${i === activeImg ? 'border-violet-500' : 'border-slate-800'}`}>
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              {product.category?.name && (
                <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">{product.category.name}</p>
              )}
              <h1 className="text-2xl font-bold text-slate-100">{product.title}</h1>
              <div className="mt-2">
                <TypeBadge type={product.product_type} size="md" />
              </div>
            </div>
            <StatusBadge product={product} />
          </div>

          <PriceTag price={product.price} compareAt={product.compare_at_price} currency={product.currency} />

          {product.rating_count > 0 && (
            <p className="text-sm text-slate-400">
              ★ {product.rating_avg} <span className="text-slate-600">({product.rating_count} reviews)</span>
            </p>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
            {product.status === 'coming_soon' ? (
              <p>This product is coming soon.{product.release_date && ` Expected: ${new Date(product.release_date).toLocaleDateString()}`}</p>
            ) : product.is_available ? (
              <p className="text-emerald-400">✓ Available</p>
            ) : (
              <p className="text-red-400">Not Available</p>
            )}
          </div>

          {/* Delivery time badge */}
          {product.delivery_time && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <svg className="h-4 w-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-amber-300 font-medium">Delivery: {product.delivery_time}</span>
            </div>
          )}

          {product.description && (
            <div>
              <h2 className="mb-2 font-semibold text-slate-200">Description</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-400">{product.description}</p>
            </div>
          )}

          {product.rules && <RulesSection rules={product.rules} />}

          <div className="flex gap-3">
            {product.status === 'active' && product.is_available && (
              <>
                {/* Quantity stepper — capped at MAX_ON_DEMAND_QTY; purchase never depends on real stock counts */}
                <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="w-10 text-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 transition"
                  >−</button>
                  <span className="w-8 text-center font-mono text-sm font-semibold text-slate-100">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(MAX_ON_DEMAND_QTY, q + 1))}
                    disabled={qty >= MAX_ON_DEMAND_QTY}
                    className="w-10 text-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 transition"
                  >+</button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="flex-1 rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50"
                >
                  {adding ? 'Adding…' : 'Add to Cart'}
                </button>
              </>
            )}
            {product.status === 'active' && !product.is_available && (
              <button
                disabled={true}
                className="flex-1 rounded-xl border border-slate-700 py-3 font-semibold text-slate-500 bg-slate-900/10 cursor-not-allowed transition"
              >
                Not Available
              </button>
            )}
            {product.status === 'coming_soon' && (
              <button
                disabled={true}
                className="flex-1 rounded-xl border border-slate-700 py-3 font-semibold text-slate-500 bg-slate-900/10 cursor-not-allowed transition"
              >
                Pre-order
              </button>
            )}

            <button
              onClick={handleToggleFavorite}
              disabled={favLoading}
              className={`rounded-xl border px-4 py-3 transition ${
                isFavorited
                  ? 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                  : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              {isFavorited ? (
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-16 border-t border-slate-800 pt-10">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Review Form & Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Customer Reviews</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-100">
                  {product.rating_avg ? parseFloat(product.rating_avg).toFixed(2) : '0.00'}
                </span>
                <div>
                  <div className="flex text-amber-400 text-sm">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const starRating = Math.round(product.rating_avg || 0)
                      return (
                        <span key={idx} className="transition-colors">
                          {idx < starRating ? '★' : '☆'}
                        </span>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Based on {product.rating_count} review{product.rating_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Form container */}
            <div id="write-review" className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-slate-200 mb-4">Write a Review</h3>
              {reviewSuccess ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                  Thank you for your feedback! Your review has been submitted successfully.
                </div>
              ) : !user ? (
                <p className="text-xs text-slate-500">
                  Please <Link to="/login" className="text-violet-400 hover:underline">sign in</Link> to share your experience with this product.
                </p>
              ) : reviews.some((r) => r.user_id === user.id) ? (
                <p className="text-xs text-slate-500">
                  You have already submitted a review for this product. Thank you!
                </p>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  {reviewError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                      {reviewError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Rating</label>
                    <RatingInput value={ratingInput} onChange={setRatingInput} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Your Review</label>
                    <textarea
                      required
                      rows={4}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Tell us what you think of this product..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 outline-none focus:border-violet-500 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Submitting…' : 'Submit Review'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-slate-200">Reviews History</h3>
            {loadingReviews ? (
              <div className="flex py-8 justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">There are no reviews for this product yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
                    <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{r.user_name}</p>
                        <div className="flex text-amber-400 text-xs mt-1">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <span key={idx}>
                              {idx < r.rating ? '★' : '☆'}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.is_verified_purchase && (
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                            ✓ Verified Purchase
                          </span>
                        )}
                        <span className="text-[10px] text-slate-605">
                          {new Date(r.created_at + 'Z').toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}
