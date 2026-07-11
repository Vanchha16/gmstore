import client from './client'

// Public catalog
export const getProducts = (params) => client.get('/products', { params })
export const getBestSale = () => client.get('/products/best-sale')
export const getComingSoon = () => client.get('/products/coming-soon')
export const getSoldOut = () => client.get('/products/sold-out')
export const getProduct = (slug) => client.get(`/products/${slug}`)
export const getCategories = () => client.get('/products/categories')

// Admin products
export const adminListProducts = (params) => client.get('/admin/products', { params })
export const adminGetProduct = (id) => client.get(`/admin/products/${id}`)
export const adminCreateProduct = (data) => client.post('/admin/products', data)
export const adminUpdateProduct = (id, data) => client.patch(`/admin/products/${id}`, data)
export const adminDeleteProduct = (id) => client.delete(`/admin/products/${id}`)
export const adminUploadImage = (id, file) => {
  const fd = new FormData(); fd.append('file', file)
  return client.post(`/admin/products/${id}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const adminDeleteImage = (imageId) => client.delete(`/admin/products/images/${imageId}`)

// Admin categories
export const adminListCategories = () => client.get('/admin/products/categories')
export const adminCreateCategory = (data) => client.post('/admin/products/categories', data)
export const adminUpdateCategory = (id, data) => client.patch(`/admin/products/categories/${id}`, data)
export const adminDeleteCategory = (id) => client.delete(`/admin/products/categories/${id}`)

// Admin stock
export const adminAddStock = (productId, payloads) => client.post(`/admin/products/${productId}/stock`, { payloads })
export const adminListStock = (productId, params) => client.get(`/admin/products/${productId}/stock`, { params })
export const adminGetAwaitingCount = (productId) => client.get(`/admin/products/${productId}/awaiting-count`)
export const adminDeleteStock = (itemId) => client.delete(`/admin/products/stock/${itemId}`)
export const adminUpdateStock = (itemId, data) => client.patch(`/admin/products/stock/${itemId}`, data)

// Profile & Account
export const getUserProfile = () => client.get('/me')
export const updateUserProfile = (data) => client.patch('/me', data)
export const updateUserPassword = (data) => client.patch('/me/password', data)
export const getUserFavorites = () => client.get('/me/favorites')
export const getUserPreorders = () => client.get('/me/preorders')

// Engagement & Wishlist
export const addFavorite = (productId) => client.post(`/products/${productId}/favorite`)
export const removeFavorite = (productId) => client.delete(`/products/${productId}/favorite`)
export const addPreorder = (productId) => client.post(`/products/${productId}/preorder`)
export const cancelPreorder = (productId) => client.delete(`/products/${productId}/preorder`)
export const getProductReviews = (productId, params) => client.get(`/products/${productId}/reviews`, { params })
export const addProductReview = (productId, data) => client.post(`/products/${productId}/reviews`, data)

// Cart & Checkout
export const getCart = () => client.get('/cart')
export const addCartItem = (data) => client.post('/cart/items', data)
export const updateCartItem = (itemId, data) => client.patch(`/cart/items/${itemId}`, data)
export const deleteCartItem = (itemId) => client.delete(`/cart/items/${itemId}`)
export const checkout = (data) => client.post('/checkout', data)
export const getOrderPaymentStatus = (orderId) => client.get(`/orders/${orderId}/payment-status`)
export const mockPay = (data) => client.post('/payment/mock/pay', data)
export const cancelOrder = (orderId) => client.post(`/orders/${orderId}/cancel`)

// Admin users
export const adminListUsers = (params) => client.get('/admin/users', { params })
export const adminGetUser = (id) => client.get(`/admin/users/${id}`)
export const adminUpdateUser = (id, data) => client.patch(`/admin/users/${id}`, data)

// Admin orders
export const adminListOrders = (params) => client.get('/admin/orders', { params })
export const adminGetOrder = (id) => client.get(`/admin/orders/${id}`)
export const adminUpdateOrder = (id, data) => client.patch(`/admin/orders/${id}`, data)
export const adminRefundOrder = (id) => client.post(`/admin/orders/${id}/refund`)
export const adminDeliverOrder = (id) => client.post(`/admin/orders/${id}/deliver`)

// Wallet (customer)
export const getWallet = (params) => client.get('/me/wallet', { params })
export const createWalletTopup = (amount) => client.post('/me/wallet/topup', { amount })
export const getWalletTopupStatus = (topupId) => client.get(`/me/wallet/topup/${topupId}/status`)

// Admin wallets
export const adminListWallets = (params) => client.get('/admin/wallets', { params })
export const adminGetUserWallet = (userId, params) => client.get(`/admin/wallets/${userId}`, { params })
export const adminAdjustWallet = (userId, data) => client.post(`/admin/wallets/${userId}/adjust`, data)
