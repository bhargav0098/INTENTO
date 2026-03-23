'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Target, BarChart2, Settings, Zap } from 'lucide-react'

const navItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Target, label: 'New Goal', href: '/goal/new' },
  { icon: BarChart2, label: 'Analytics', href: '/analytics' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="w-64 bg-[#12121A] border-r border-[#2D2D44] flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-[#2D2D44]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] rounded-xl flex items-center justify-center shadow-lg shadow-[#7C3AED]/40">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">INTENTO</span>
            <p className="text-[10px] text-[#7C3AED] font-medium">AI Agent Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group
                ${active
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/30'
                  : 'text-[#94A3B8] hover:bg-[#1A1A2E] hover:text-white'
                }`}
            >
              <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${active ? 'text-white' : ''}`} />
              <span className="font-medium text-sm">{item.label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-[#2D2D44]">
        <div className="bg-gradient-to-r from-[#7C3AED]/10 to-[#6D28D9]/10 border border-[#7C3AED]/20 rounded-xl p-3">
          <p className="text-xs font-semibold text-[#7C3AED] mb-1">Solasta 2026</p>
          <p className="text-[10px] text-[#94A3B8]">GDG on Campus IIITDM</p>
        </div>
      </div>
    </div>
  )
}
