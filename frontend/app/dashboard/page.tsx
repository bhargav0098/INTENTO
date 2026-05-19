'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import API, { progressAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Target, CheckCircle, XCircle, Flame, Clock, Plus, ArrowRight, Zap, Trash2 } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<any>(null)
  const [activeGoals, setActiveGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  const fetchDashboardData = () => {
    progressAPI.analytics('all').then(res => setAnalytics(res.data)).catch(() => {}).finally(() => setLoading(false))
    API.get('/checkin/active-goals').then(res => {
      setActiveGoals(res.data.active_goals || [])
    }).catch(() => {})
  }

  useEffect(() => {
    if (!localStorage.getItem('intento_token')) { router.push('/'); return }
    fetchDashboardData()
  }, [])

  const handleDelete = async (goalId: string) => {
    if(!confirm('Delete this goal? This cannot be undone.')) return
    try {
        await API.delete(`/goals/${goalId}`)
        showToast('success', '🗑️ Goal deleted')
        // Force full page reload to get fresh data
        window.location.reload()
    } catch(err: any) {
        console.error("DELETE ERROR:", err.response?.data)
        showToast('error', 'Failed to delete: ' + 
            (err.response?.data?.message || err.message))
    }
  }

  const stats = [
    { label: 'Total Goals', value: analytics?.total_goals ?? 0, icon: Target, color: '#7C3AED', bg: 'bg-[#7C3AED]/10 border-[#7C3AED]/20' },
    { label: 'Completed', value: analytics?.completed ?? 0, icon: CheckCircle, color: '#10B981', bg: 'bg-[#10B981]/10 border-[#10B981]/20' },
    { label: 'Success Rate', value: `${analytics?.success_rate ?? 0}%`, icon: Flame, color: '#F59E0B', bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20' },
    { label: 'Avg Time', value: analytics?.avg_time ?? 'N/A', icon: Clock, color: '#94A3B8', bg: 'bg-[#94A3B8]/10 border-[#94A3B8]/20' },
  ]

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto page-enter">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            Hello, {user?.name?.split(' ')[0] || 'Agent'}!
          </h1>
          <p className="text-[#94A3B8] mt-1">Your AI execution dashboard — think less, achieve more.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className={`border rounded-2xl p-4 card-hover ${stat.bg}`}>
              <div className="flex items-center gap-2 mb-3">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-[#94A3B8] font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-black text-white count-animate">{loading ? '—' : stat.value}</p>
            </div>
          ))}
        </div>

        {/* Active execution banner */}
        {user?.active_execution && (
          <div className="bg-gradient-to-r from-[#7C3AED]/20 to-[#6D28D9]/10 border border-[#7C3AED]/40 rounded-2xl p-5 mb-6 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#7C3AED]/30 rounded-xl flex items-center justify-center relative">
                  <span className="ping-slow absolute inline-flex h-full w-full rounded-xl bg-[#7C3AED] opacity-75" />
                  <Zap className="w-5 h-5 text-[#7C3AED] relative" />
                </div>
                <div>
                  <p className="font-bold text-white">Execution In Progress</p>
                  <p className="text-xs text-[#94A3B8]">Your AI agents are working...</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/execution/${user.active_execution}`)}
                className="flex items-center gap-2 bg-[#7C3AED] text-white text-sm px-4 py-2 rounded-xl hover:bg-[#6D28D9] transition-colors"
              >
                View Live <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Goals needing checkin today */}
        {activeGoals.length > 0 && (
          <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/30 rounded-2xl p-4 mb-6">
            <p className="text-[#7C3AED] font-semibold text-sm mb-2">
              Daily Check-in Reminder
            </p>
            <p className="text-[#94A3B8] text-xs mb-3">
              {activeGoals.length} goal(s) waiting for today's check-in
            </p>
            {activeGoals.map(g => (
              <div
                key={g.goal_id || g._id}
                className="flex items-center justify-between p-3 bg-[#0A0A0F] border border-[#2D2D44] rounded-xl mb-2 hover:border-[#7C3AED]/50 transition cursor-pointer group"
                onClick={() => {
                   const gid = g.goal_id || g._id;
                   console.log("CHECKIN GOAL ID:", gid);
                   window.location.href = `/checkin/${gid}`;
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{g.goal_text}</p>
                  <p className="text-[#94A3B8] text-xs mt-0.5">Tap to check in</p>
                </div>
                <button
                   onClick={(e) => {
                     e.stopPropagation();
                     handleDelete(g.goal_id || g._id);
                   }}
                   className="text-[#EF4444] hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                   <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recent goals */}
        <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-6 mb-6 relative">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-lg">Recent Goals</h3>
            <button onClick={() => router.push('/analytics')} className="text-[#7C3AED] text-sm hover:underline">View all</button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 skeleton-shimmer rounded-xl" />)}</div>
          ) : analytics?.goals?.length > 0 ? (
            <div className="space-y-2">
              {analytics.goals.slice(0, 5).map((goal: any, index: number) => (
                <div key={goal.goal_id}
                  className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl border border-[#2D2D44] hover:border-[#7C3AED]/30 transition-colors group step-animate"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="flex-shrink-0 flex items-center justify-center w-6">
                      {goal.status === 'completed' ? <CheckCircle className="w-4 h-4 text-[#10B981]" /> :
                       goal.status === 'failed' ? <XCircle className="w-4 h-4 text-[#EF4444]" /> :
                       <Clock className="w-4 h-4 text-[#F59E0B]" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{goal.goal_text}</p>
                      <p className="text-xs text-[#94A3B8]">{goal.created_at}</p>
                      {/* Real Progress Bar */}
                      {goal.real_progress !== undefined && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-[#94A3B8]">Real Progress</span>
                            <span className="text-[#7C3AED] font-bold">{goal.real_progress}%</span>
                          </div>
                          <div className="h-1 bg-[#2D2D44] rounded-full overflow-hidden w-32">
                            <div
                              className="h-full bg-[#7C3AED] rounded-full"
                              style={{ width: `${goal.real_progress}%` }}
                            />
                          </div>
                          {goal.streak > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Flame className="w-3 h-3 text-orange-400" />
                              <span className="text-[10px] text-orange-400 font-bold">{goal.streak} day streak</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/results/${goal.goal_id}`) }}
                        className="text-[#7C3AED] text-xs font-medium"
                    >
                        View →
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(goal.goal_id) }}
                        className="text-[#EF4444] hover:text-red-400 transition-colors p-1 rounded ml-2"
                        title="Delete Goal"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-[#1A1A2E] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Target className="w-6 h-6 text-[#94A3B8]" />
              </div>
              <p className="text-[#94A3B8] text-sm mb-4">No goals yet. Start your first one!</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/goal/new')}
          className="w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#7C3AED]/30 text-lg flex items-center justify-center gap-3 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Start New Goal
        </button>
      </div>
    </AppLayout>
  )
}
