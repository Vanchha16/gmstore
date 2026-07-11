import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getUserProfile, updateUserProfile, updateUserPassword } from '../../api/endpoints'
import AccountLayout from './AccountLayout'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '', avatar_url: '' })
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [profileMsg, setProfileMsg] = useState(null)
  const [pwMsg, setPwMsg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getUserProfile()
      .then(({ data }) => {
        setProfile(data)
        setFullName(data.full_name || '')
        setPhone(data.phone || '')
        setAvatarUrl(data.avatar_url || '')
      })
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    setError(null)
    try {
      const { data } = await updateUserProfile({ full_name: fullName, phone, avatar_url: avatarUrl })
      setProfile(data)
      setUser(data) // update AuthContext
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile.' })
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    setError(null)

    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    try {
      await updateUserPassword({ old_password: oldPassword, new_password: newPassword })
      setPwMsg({ type: 'success', text: 'Password changed successfully!' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' })
    }
  }

  if (loading) {
    return (
      <AccountLayout>
        <div className="flex py-12 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      </AccountLayout>
    )
  }

  return (
    <AccountLayout>
      <h2 className="mb-6 text-2xl font-bold text-slate-100">Profile Information</h2>
      
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* General Profile Section */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">Update Profile</h3>
          {profileMsg && (
            <div className={`mb-4 rounded-xl border p-4 text-sm ${
              profileMsg.type === 'success' 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              {profileMsg.text}
            </div>
          )}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Email Address</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Avatar URL</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
            >
              Save Changes
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">Change Password</h3>
          {pwMsg && (
            <div className={`mb-4 rounded-xl border p-4 text-sm ${
              pwMsg.type === 'success' 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              {pwMsg.text}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </AccountLayout>
  )
}
