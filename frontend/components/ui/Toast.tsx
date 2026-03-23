'use client'
import { Toast as ToastType } from '@/types'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }

const colors = {
  success: 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]',
  error:   'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]',
  warning: 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]',
  info:    'border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#7C3AED]'
}

export default function Toast({ toast }: { toast: ToastType }) {
  if (!toast.show) return null
  const Icon = icons[toast.type]

  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm z-50 shadow-lg toast-enter ${colors[toast.type]}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium text-[#F1F5F9]">{toast.message}</span>
    </div>
  )
}
