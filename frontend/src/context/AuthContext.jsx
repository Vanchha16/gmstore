import { createContext, useContext, useState, useEffect } from 'react'
import client, { setAccessToken, clearAccessToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount try to restore session via refresh cookie
  useEffect(() => {
    client.post('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.access_token)
        return client.get('/me')
      })
      .then(({ data }) => setUser(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data
  }

  const register = async (email, password, full_name) => {
    const { data } = await client.post('/auth/register', { email, password, full_name })
    return data
  }

  const verifyOtp = async (email, code) => {
    const { data } = await client.post('/auth/verify-otp', { email, code })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data
  }

  const resendOtp = async (email) => {
    const { data } = await client.post('/auth/resend-otp', { email })
    return data
  }

  const logout = async () => {
    await client.post('/auth/logout').catch(() => {})
    clearAccessToken()
    setUser(null)
  }

  const forgotPassword = async (email) => {
    const { data } = await client.post('/auth/forgot-password', { email })
    return data
  }

  const resetPassword = async (email, code, new_password) => {
    const { data } = await client.post('/auth/reset-password', { email, code, new_password })
    return data
  }

  const loginWithGoogle = async (token) => {
    const { data } = await client.post('/auth/google', { token })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, resendOtp, logout, forgotPassword, resetPassword, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
