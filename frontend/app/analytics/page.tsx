'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { progressAPI } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { BarChart2, TrendingUp, Clock, Target, Flame, Trash2 } from 'lucide-react'

const TAB_PERIODS = ['week', 'month', 'all']

export default function Analytics() {
  const [period, setPeriod] = useState('week')
  const [analytics, setAnalytics] = useState<any>(null)
  const [stress, setStress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const [a, s] = await Promise.all([progressAPI.analytics(period), progressAPI.stressHistory()])
        if(!cancelled) {
            setAnalytics(a.data)
            setStress(s.data)
        }
      } catch {} finally { 
        if(!cancelled) setLoading(false) 
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [period])

  const handleDelete = async (goalId: string) => {
    if(!confirm('Are you sure? This cannot be undone.')) return
    try {
        const { goalsAPI } = require('@/lib/api')
        await goalsAPI.delete(goalId)
        showToast('success', '🗑️ Goal deleted')
        const [a, s] = await Promise.all([progressAPI.analytics(period), progressAPI.stressHistory()])
        setAnalytics(a.data)
        setStress(s.data)
    } catch {
        showToast('error', 'Failed to delete goal')
    }
  }

  const maxStress = stress?.history?.length > 0 ? Math.max(...stress.history.map((h: any) => h.stress_score)) : 1

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">📊 Analytics</h1>
            <p className="text-[#94A3B8] mt-1">Your execution performance overview</p>
          </div>
          <div className="flex bg-[#12121A] border border-[#2D2D44] rounded-xl p-1 gap-1">
            {TAB_PERIODS.map((t) => (
              <button key={t} onClick={() => setPeriod(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all
                  ${period === t ? 'bg-[#7C3AED] text-white shadow' : 'text-[#94A3B8] hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-[#12121A] rounded-2xl animate-pulse" />)}</div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Goals', value: analytics?.total_goals || 0, icon: Target, color: '#7C3AED' },
                { label: 'Completed', value: analytics?.completed || 0, icon: TrendingUp, color: '#10B981' },
                { label: 'Success Rate', value: `${analytics?.success_rate || 0}%`, icon: Flame, color: '#F59E0B' },
                { label: 'Avg Time', value: analytics?.avg_time || 'N/A', icon: Clock, color: '#94A3B8' },
              ].map((s) => (
                <div key={s.label} className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-4">
                  <s.icon className="w-5 h-5 mb-2" style={{ color: s.color }} />
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-[#94A3B8] mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Stress trend */}
            {stress?.history?.length > 0 && (
              <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-5 h-5 text-[#7C3AED]" />
                  <h3 className="font-bold text-white">Stress Level Trend</h3>
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium border
                    ${stress.current_level === 'high' ? 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10' :
                      stress.current_level === 'moderate' ? 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10' :
                        'text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10'}`}>
                    {stress.current_level?.toUpperCase()}: {Math.round(stress.current_stress * 100)}%
                  </span>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {stress.history.map((h: any, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${(h.stress_score / maxStress) * 80}px`,
                          background: h.level === 'high' ? '#EF4444' : h.level === 'moderate' ? '#F59E0B' : '#10B981',
                          opacity: 0.8
                        }} />
                      <span className="text-[10px] text-[#4B5563]">{h.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goal categories */}
            {analytics?.categories && Object.keys(analytics.categories).length > 0 && (
              <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-5 mb-6">
                <h3 className="font-bold text-white mb-4">Goal Categories</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.categories).map(([cat, count]) => {
                    const pct = Math.round((Number(count) / analytics.total_goals) * 100)
                    return (
                      <div key={cat}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-[#94A3B8] capitalize">{cat.replace('_', ' ')}</span>
                          <span className="text-xs text-white font-medium">{String(count)}</span>
                        </div>
                        <div className="h-2 bg-[#0A0A0F] rounded-full overflow-hidden">
                          <div className="h-2 bg-gradient-to-r from-[#7C3AED] to-[#9F67FF] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent Goals */}
            {analytics?.goals?.length > 0 && (
              <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-5">
                <h3 className="font-bold text-white mb-4">Goals in Period</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analytics.goals.map((goal: any) => (
                    <div key={goal.goal_id} className="flex items-center gap-3 p-3 bg-[#0A0A0F] rounded-xl border border-[#2D2D44] hover:border-[#7C3AED]/30 transition-colors group">
                      <span className="cursor-pointer" onClick={() => router.push(`/results/${goal.goal_id}`)}>{goal.status === 'completed' ? '✅' : goal.status === 'failed' ? '❌' : '⏳'}</span>
                      <p className="text-sm text-white font-medium flex-1 truncate cursor-pointer" onClick={() => router.push(`/results/${goal.goal_id}`)}>{goal.goal_text}</p>
                      <span className="text-xs text-[#4B5563] flex-shrink-0">{goal.created_at}</span>
                      <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(goal.goal_id) }}
                          className="text-[#EF4444] hover:text-red-400 transition-colors p-1 rounded ml-2 opacity-0 group-hover:opacity-100"
                          title="Delete Goal"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!analytics?.total_goals && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-[#94A3B8]">No goals in this period. Start one!</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
