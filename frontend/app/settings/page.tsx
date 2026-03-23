'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { authAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { User, Lock, Trash2, Settings as SettingsIcon, LogOut, Key } from 'lucide-react'

export default function Settings() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState<'profile' | 'security'>('profile')
  const [loading, setLoading] = useState(false)
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })

  useEffect(() => {
    if (!localStorage.getItem('intento_token')) router.push('/')
  }, [])

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      showToast('error', 'Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authAPI.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password })
      showToast('success', 'Password changed successfully')
      setPwForm({ old_password: '', new_password: '', confirm: '' })
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to change password')
    } finally { setLoading(false) }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('This will permanently delete all your data. Are you sure?')) return
    const confirm2 = prompt('Type "DELETE" to confirm:')
    if (confirm2 !== 'DELETE') return
    try {
      await authAPI.deleteAccount()
      logout()
    } catch {
      showToast('error', 'Failed to delete account')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto page-enter">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <SettingsIcon className="w-8 h-8 text-[#7C3AED]" /> Settings
            </h1>
            <p className="text-[#94A3B8] mt-1">Manage your account and preferences</p>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#EF4444] transition-colors bg-[#1A1A2E] px-4 py-2 rounded-xl">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#12121A] border border-[#2D2D44] rounded-xl p-1 gap-1 mb-6">
          {[{ id: 'profile', label: 'Profile', icon: User }, { id: 'security', label: 'Security', icon: Lock }].map((t) => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === t.id ? 'bg-[#7C3AED] text-white shadow' : 'text-[#94A3B8] hover:text-white'}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'profile' && (
          <div className="space-y-5 modal-enter">
            <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-[#7C3AED]/30 relative">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] border-2 border-[#12121A]" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{user?.name}</p>
                  <p className="text-sm text-[#94A3B8]">{user?.email}</p>
                  <span className="text-xs text-[#7C3AED] font-medium bg-[#7C3AED]/10 px-3 py-1 rounded-full mt-2 inline-flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    Connected
                  </span>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="bg-[#0A0A0F] border border-[#2D2D44] rounded-xl p-4">
                  <p className="text-xs text-[#4B5563] uppercase tracking-wider mb-1">Full Name</p>
                  <p className="text-white font-medium">{user?.name}</p>
                </div>
                <div className="bg-[#0A0A0F] border border-[#2D2D44] rounded-xl p-4">
                  <p className="text-xs text-[#4B5563] uppercase tracking-wider mb-1">Email Address</p>
                  <p className="text-white font-medium">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="bg-[#EF4444]/5 border border-[#EF4444]/30 rounded-2xl p-5">
              <h3 className="text-[#EF4444] font-bold mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Danger Zone</h3>
              <p className="text-xs text-[#94A3B8] mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
              <button onClick={handleDeleteAccount}
                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <Trash2 className="w-4 h-4" /> Delete My Account
              </button>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-6 modal-enter">
            <h3 className="font-bold text-white mb-5 flex items-center gap-2"><Key className="w-4 h-4 text-[#7C3AED]" /> Change Password</h3>
            <div className="space-y-4">
              {[
                { label: 'Current Password', key: 'old_password', placeholder: '••••••••' },
                { label: 'New Password', key: 'new_password', placeholder: 'Min 8 characters' },
                { label: 'Confirm New Password', key: 'confirm', placeholder: '••••••••' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-xs text-[#94A3B8] font-medium mb-1.5 block uppercase tracking-wider">{field.label}</label>
                  <input type="password" placeholder={field.placeholder}
                    value={(pwForm as any)[field.key]}
                    onChange={(e) => setPwForm({ ...pwForm, [field.key]: e.target.value })}
                    className="w-full bg-[#0A0A0F] border border-[#2D2D44] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/30 transition-all" />
                </div>
              ))}
              <button onClick={handleChangePassword} disabled={loading || !pwForm.old_password || !pwForm.new_password}
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold py-3 rounded-xl disabled:opacity-40 transition-all shadow-lg shadow-[#7C3AED]/30 mt-2 flex items-center justify-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
