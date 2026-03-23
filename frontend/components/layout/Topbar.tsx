'use client'
import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function Topbar() {
  const { user, logout } = useAuth()
  const router = useRouter()

  // Calculate generic percentage based on status for the pulse ring UI
  // Real percentage is tracked in the execution page, this is just for the global banner
  const execPercentage = user?.active_execution ? 45 : null // placeholder

  return (
    <div className="h-16 bg-[#12121A] border-b border-[#2D2D44] flex items-center justify-between px-6 flex-shrink-0">
      {/* Active execution indicator */}
      <div className="flex items-center gap-4">
        {user?.active_execution && execPercentage !== null && (
          <button
            onClick={() => router.push(`/execution/${user.active_execution}`)}
            className="flex items-center gap-2 bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-[#7C3AED] px-3 py-1.5 rounded-full text-sm font-medium hover:bg-[#7C3AED]/30 transition relative"
          >
            {/* Pulse ring */}
            <span className="relative flex h-2 w-2">
              <span className="ping-slow absolute inline-flex h-full w-full rounded-full bg-[#7C3AED] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]" />
            </span>
            <span>Executing</span>
            <span className="bg-[#7C3AED] text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {Math.round(execPercentage)}%
            </span>
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center hover:border-[#7C3AED]/50 transition-colors">
          <Bell className="w-4 h-4 text-[#94A3B8]" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-[#2D2D44]">
          <div className="w-8 h-8 bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] rounded-full flex items-center justify-center text-white font-bold text-sm shadow shadow-[#7C3AED]/40">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm text-[#F1F5F9] font-medium leading-none">{user?.name}</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-[#94A3B8] hover:text-[#EF4444] transition-colors text-sm px-2 py-1.5 rounded-lg hover:bg-[#EF4444]/10"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
