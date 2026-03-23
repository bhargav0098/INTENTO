'use client'
import { useState } from 'react'
import { Toast } from '@/types'

export const useToast = () => {
  const [toast, setToast] = useState<Toast>({
    show: false,
    type: 'info',
    message: ''
  })

  const showToast = (type: Toast['type'], message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast({ show: false, type: 'info', message: '' }), 3500)
  }

  return { toast, showToast, setToast }
}
