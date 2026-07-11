import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './routes/ProtectedRoute'
import AdminRoute from './routes/AdminRoute'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'

import Home from './pages/Home'
import BestSale from './pages/BestSale'
import ComingSoon from './pages/ComingSoon'
import SoldOut from './pages/SoldOut'
import Search from './pages/Search'
import ProductDetail from './pages/ProductDetail'
import Contact from './pages/Contact'

import Register from './pages/auth/Register'
import VerifyOtp from './pages/auth/VerifyOtp'
import Login from './pages/auth/Login'
import ForgotPassword from './pages/auth/ForgotPassword'

import AdminDashboard from './pages/admin/Dashboard'
import AdminProducts from './pages/admin/Products'
import ProductForm from './pages/admin/ProductForm'
import AdminStock from './pages/admin/Stock'
import AdminCategories from './pages/admin/Categories'
import AdminMessages from './pages/admin/Messages'
import AdminReviews from './pages/admin/Reviews'
import AdminOrders from './pages/admin/Orders'
import AdminUsers from './pages/admin/Users'
import AdminWallets from './pages/admin/Wallets'
import AdminChat from './pages/admin/Chat'
import ChatWidget from './components/chat/ChatWidget'

import Profile from './pages/account/Profile'
import PurchaseHistory from './pages/account/PurchaseHistory'
import OrderDetail from './pages/account/OrderDetail'
import Favorites from './pages/account/Favorites'
import Preorders from './pages/account/Preorders'
import Wallet from './pages/account/Wallet'

import { CartProvider } from './context/CartContext'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import PaymentKhqr from './pages/PaymentKhqr'
import OrderSuccess from './pages/OrderSuccess'

function Layout({ children }) {
  const location = useLocation()
  const isAdminPath = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      {!isAdminPath && <Footer />}
      <ChatWidget />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <CartProvider>
          <Routes>
            {/* Auth — no navbar */}
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Public */}
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/best-sale" element={<Layout><BestSale /></Layout>} />
            <Route path="/coming-soon" element={<Layout><ComingSoon /></Layout>} />
            <Route path="/sold-out" element={<Layout><SoldOut /></Layout>} />
            <Route path="/search" element={<Layout><Search /></Layout>} />
            <Route path="/products/:slug" element={<Layout><ProductDetail /></Layout>} />
            <Route path="/contact" element={<Layout><Contact /></Layout>} />

            {/* Admin */}
            <Route path="/admin/dashboard" element={<Layout><AdminRoute><AdminDashboard /></AdminRoute></Layout>} />
            <Route path="/admin/products" element={<Layout><AdminRoute><AdminProducts /></AdminRoute></Layout>} />
            <Route path="/admin/products/new" element={<Layout><AdminRoute><ProductForm /></AdminRoute></Layout>} />
            <Route path="/admin/products/:id/edit" element={<Layout><AdminRoute><ProductForm /></AdminRoute></Layout>} />
            <Route path="/admin/products/:id/stock" element={<Layout><AdminRoute><AdminStock /></AdminRoute></Layout>} />
            <Route path="/admin/categories" element={<Layout><AdminRoute><AdminCategories /></AdminRoute></Layout>} />
            <Route path="/admin/messages" element={<Layout><AdminRoute><AdminMessages /></AdminRoute></Layout>} />
            <Route path="/admin/reviews" element={<Layout><AdminRoute><AdminReviews /></AdminRoute></Layout>} />
            <Route path="/admin/orders" element={<Layout><AdminRoute><AdminOrders /></AdminRoute></Layout>} />
            <Route path="/admin/users" element={<Layout><AdminRoute><AdminUsers /></AdminRoute></Layout>} />
            <Route path="/admin/wallets" element={<Layout><AdminRoute><AdminWallets /></AdminRoute></Layout>} />
            <Route path="/admin/chat" element={<Layout><AdminRoute><AdminChat /></AdminRoute></Layout>} />

            {/* Account */}
            <Route path="/account/profile" element={<Layout><ProtectedRoute><Profile /></ProtectedRoute></Layout>} />
            <Route path="/account/history" element={<Layout><ProtectedRoute><PurchaseHistory /></ProtectedRoute></Layout>} />
            <Route path="/account/history/:id" element={<Layout><ProtectedRoute><OrderDetail /></ProtectedRoute></Layout>} />
            <Route path="/account/favorites" element={<Layout><ProtectedRoute><Favorites /></ProtectedRoute></Layout>} />
            <Route path="/account/preorders" element={<Layout><ProtectedRoute><Preorders /></ProtectedRoute></Layout>} />
            <Route path="/account/wallet" element={<Layout><ProtectedRoute><Wallet /></ProtectedRoute></Layout>} />

            {/* Cart & Checkout */}
            <Route path="/cart" element={<Layout><ProtectedRoute><Cart /></ProtectedRoute></Layout>} />
            <Route path="/checkout" element={<Layout><ProtectedRoute><Checkout /></ProtectedRoute></Layout>} />
            <Route path="/payment/khqr" element={<Layout><ProtectedRoute><PaymentKhqr /></ProtectedRoute></Layout>} />
            <Route path="/order-success" element={<Layout><ProtectedRoute><OrderSuccess /></ProtectedRoute></Layout>} />
          </Routes>
        </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
