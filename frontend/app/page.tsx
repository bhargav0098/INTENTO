'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, Zap, LogIn, UserPlus } from 'lucide-react'
import { authAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const { user, login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.push('/dashboard')
  }, [user])

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setError('Email and password are required')
      return
    }
    if (!isLogin && !form.name) {
      setError('Name is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = isLogin
        ? await authAPI.login({
            email: form.email.trim().toLowerCase(),
            password: form.password
          })
        : await authAPI.register({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password
          })

      if (!res.data?.access_token) {
        throw new Error('No token received')
      }

      login(res.data.access_token, res.data.user)
      router.push('/dashboard')

    } catch (err: any) {
      console.error('Full error:', err)
      console.error('Response:', err?.response)
      console.error('Response data:', err?.response?.data)
      console.error('Status:', err?.response?.status)

      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden page-enter">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#7C3AED]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#6D28D9]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-[#7C3AED]/40">
            <Zap className="w-11 h-11 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">INTENTO</h1>
          <p className="text-[#94A3B8] mt-2 text-sm">AI That Thinks, Plans &amp; Delivers Real Outcomes</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            <span className="text-xs text-[#10B981] font-medium">Solasta 2026 — GDG IIITDM Kurnool</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#12121A]/90 border border-[#2D2D44] rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>

          {!isLogin && (
            <div className="mb-4">
              <label className="text-xs text-[#94A3B8] font-medium mb-1.5 block uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#0A0A0F] border border-[#2D2D44] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/30 transition-all"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs text-[#94A3B8] font-medium mb-1.5 block uppercase tracking-wider">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#0A0A0F] border border-[#2D2D44] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/30 transition-all"
            />
          </div>

          <div className="mb-5">
            <label className="text-xs text-[#94A3B8] font-medium mb-1.5 block uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#0A0A0F] border border-[#2D2D44] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/30 transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#2D2D44]" />
            <span className="text-xs text-[#94A3B8]">Secure login powered by JWT</span>
            <div className="flex-1 h-px bg-[#2D2D44]" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#EF4444]">
                  {isLogin ? 'Login failed' : 'Registration failed'}
                </p>
                <p className="text-xs text-[#EF4444]/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-[#7C3AED]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Please wait...</span>
              </>
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Enter INTENTO</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>

          <p className="text-center text-[#94A3B8] mt-5 text-sm">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="text-[#7C3AED] hover:text-[#9F67FF] font-semibold transition-colors"
            >
              {isLogin ? 'Register here' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
