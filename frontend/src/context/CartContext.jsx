import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { getCart, addCartItem, updateCartItem, deleteCartItem, applyPromoCode, removePromoCode } from '../api/endpoints'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refreshCart = () => {
    if (!user) {
      setCart(null)
      return
    }
    setLoading(true)
    getCart()
      .then(({ data }) => setCart(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }

  // Load cart when user logs in or out
  useEffect(() => {
    refreshCart()
  }, [user])

  const addToCart = async (productId, qty = 1) => {
    if (!user) {
      throw new Error('Please sign in to add items to your cart.')
    }
    setError(null)
    try {
      const { data } = await addCartItem({ product_id: productId, qty })
      setCart(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      throw new Error(msg)
    }
  }

  const updateQty = async (itemId, qty) => {
    setError(null)
    try {
      const { data } = await updateCartItem(itemId, { qty })
      setCart(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      throw new Error(msg)
    }
  }

  const removeFromCart = async (itemId) => {
    setError(null)
    try {
      const { data } = await deleteCartItem(itemId)
      setCart(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      throw new Error(msg)
    }
  }

  const applyPromo = async (code) => {
    setError(null)
    try {
      const { data } = await applyPromoCode(code)
      setCart(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      throw new Error(msg)
    }
  }

  const removePromo = async () => {
    setError(null)
    try {
      const { data } = await removePromoCode()
      setCart(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      throw new Error(msg)
    }
  }

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.qty, 0) || 0

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        error,
        cartCount,
        refreshCart,
        addToCart,
        updateQty,
        removeFromCart,
        applyPromo,
        removePromo
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
