'use client'
import { useState, useEffect } from 'react'
import { User } from '@/types'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('intento_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = (token: string, userData: User) => {
    localStorage.setItem('intento_token', token)
    localStorage.setItem('intento_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('intento_token')
    localStorage.removeItem('intento_user')
    setUser(null)
    window.location.href = '/'
  }

  const updateUser = (updates: Partial<User>) => {
    const updated = { ...user, ...updates } as User
    localStorage.setItem('intento_user', JSON.stringify(updated))
    setUser(updated)
  }

  return { user, loading, login, logout, updateUser }
}
