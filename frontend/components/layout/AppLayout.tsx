'use client'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Toast from '../ui/Toast'
import { useToast } from '@/hooks/useToast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()

  return (
    <div className="flex h-screen bg-[#0A0A0F] text-[#F1F5F9] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
