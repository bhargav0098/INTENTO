'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { executionAPI } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { Sparkles, Lightbulb, BookOpen, DollarSign, Activity, Rocket, Calendar, Circle } from 'lucide-react'

const templates = [
  { icon: BookOpen, label: 'Study Plan', text: 'Create a 2-week study plan for GATE exam. I am weak in mathematics and work 4 hours daily.' },
  { icon: DollarSign, label: 'Finance', text: 'Create a financial plan to save ₹50,000 in 3 months with a monthly income of ₹30,000.' },
  { icon: Activity, label: 'Fitness', text: 'Create a 30-day fitness plan to lose 5kg. I can exercise 45 minutes per day in the morning.' },
  { icon: Rocket, label: 'Startup', text: 'Create a launch plan for a SaaS startup targeting college students. Timeline: 60 days.' },
  { icon: Calendar, label: 'Schedule', text: 'Organize my daily schedule for final exam week covering 6 subjects with revision time.' },
  { icon: Sparkles, label: 'Skill', text: 'Create a learning roadmap for becoming a full-stack developer in 90 days starting from basics.' },
]

export default function NewGoal() {
  const [goalText, setGoalText] = useState('')
  const [priority, setPriority] = useState('high')
  const [loading, setLoading] = useState(false)
  const [clarification, setClarification] = useState('')
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (!localStorage.getItem('intento_token')) router.push('/')
  }, [])

  const handleAnalyse = async () => {
    const trimmed = goalText.trim()
    if (!trimmed) {
      showToast('error', 'Please enter a goal')
      return
    }
    if (trimmed.length < 10) {
      showToast('error', 'Goal too short. Add more detail.')
      return
    }
    setLoading(true)
    setClarification('')
    try {
      console.log('[ANALYSE] Sending:', { goal_text: trimmed, priority })
      const res = await executionAPI.start({
        goal_text: trimmed,
        priority: priority
      })
      console.log('[ANALYSE] Response:', res.data)
      
      if (res.data.status === 'clarification_needed') {
        setClarification(res.data.question)
        setLoading(false)
        return
      }
      
      sessionStorage.setItem('intento_plan', JSON.stringify(res.data))
      window.location.href = '/goal/preview'
      
    } catch (err: any) {
      console.error('[ANALYSE ERROR]', err?.response?.data)
      showToast(
        'error',
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Failed to analyse goal. Try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto page-enter">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">🎯 Define Your Goal</h1>
          <p className="text-[#94A3B8] mt-1">The more detail you give, the better INTENTO plans your execution.</p>
        </div>

        {/* Main input */}
        <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-5 mb-5 focus-within:border-[#7C3AED]/60 transition-colors shadow-sm">
          <textarea
            value={goalText}
            onChange={(e) => setGoalText(e.target.value.slice(0, 500))}
            placeholder="e.g. Plan my GATE exam preparation for 2 weeks. I'm weak in maths and signals, work 4 hrs daily, prefer studying at night..."
            rows={6}
            className="w-full bg-transparent text-white placeholder-[#4B5563] resize-none focus:outline-none text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2D2D44]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs text-[#94A3B8]">AI will interpret and plan this goal</span>
            </div>
            <span className={`text-xs font-mono ${goalText.length > 450 ? 'text-[#F59E0B]' : 'text-[#4B5563]'}`}>
              {goalText.length}/500
            </span>
          </div>
        </div>

        {/* Clarification */}
        {clarification && (
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-4 mb-5 flex items-start gap-3 modal-enter">
            <Lightbulb className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[#F59E0B] text-sm font-medium">Clarification needed</p>
              <p className="text-[#94A3B8] text-sm mt-1">{clarification}</p>
            </div>
          </div>
        )}

        {/* Templates */}
        <div className="mb-6">
          <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-widest mb-3">Quick Templates</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {templates.map((t, index) => {
              const Icon = t.icon
              return (
                <button
                  key={t.label}
                  onClick={() => setGoalText(t.text)}
                  className="bg-[#1A1A2E] border border-[#2D2D44] text-left p-3 rounded-xl hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/5 transition-all group step-animate"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Icon className="w-5 h-5 mb-2 text-[#94A3B8] group-hover:text-[#7C3AED] transition-colors" />
                  <p className="text-xs text-white font-medium group-hover:text-[#7C3AED] transition-colors">{t.label}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority */}
        <div className="mb-8">
          <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-widest mb-3">Execution Priority</p>
          <div className="flex gap-3">
            {[
              { value: 'high', label: 'High', colorFill: 'fill-[#EF4444]', colorText: 'text-[#EF4444]', desc: 'Aggressive plan' },
              { value: 'medium', label: 'Medium', colorFill: 'fill-[#F59E0B]', colorText: 'text-[#F59E0B]', desc: 'Balanced' },
              { value: 'low', label: 'Low', colorFill: 'fill-[#10B981]', colorText: 'text-[#10B981]', desc: 'Relaxed pace' }
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className={`flex-1 px-4 py-3 rounded-xl border transition-all text-left card-hover
                  ${priority === p.value
                    ? 'bg-[#1A1A2E] border-[#7C3AED] shadow-sm shadow-[#7C3AED]/20'
                    : 'bg-[#12121A] border-[#2D2D44] hover:border-[#7C3AED]/40'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Circle className={`w-3 h-3 ${p.colorFill} ${p.colorText}`} />
                  <span className={`text-sm font-bold ${priority === p.value ? 'text-white' : 'text-[#94A3B8]'}`}>{p.label}</span>
                </div>
                <span className="text-xs text-[#4B5563] ml-5 block">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnalyse}
          disabled={loading || goalText.trim().length < 10}
          className="w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6] text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#7C3AED]/30 disabled:opacity-40 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-3"
        >
          {loading ? (
            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analysing with AI...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Analyse &amp; Generate Plan</>
          )}
        </button>
      </div>
    </AppLayout>
  )
}
