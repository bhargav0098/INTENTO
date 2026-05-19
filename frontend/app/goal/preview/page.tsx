'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { executionAPI } from '@/lib/api'
import {
  Clock, Layers, Zap, ChevronRight,
  AlertCircle, Play, RefreshCw, ArrowLeft
} from 'lucide-react'

export default function PlanPreview() {
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('intento_plan')
    if (stored) {
      try {
        setPlan(JSON.parse(stored))
      } catch {
        router.push('/goal/new')
      }
    } else {
      router.push('/goal/new')
    }
  }, [])

  const handleRun = async () => {
    setLoading(true)
    try {
      await executionAPI.approve(plan.goal_id)
      window.location.href = `/execution/${plan.goal_id}`
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
        'Failed to start. Please try again.'
      )
      setLoading(false)
    }
  }

  const handleRegenerate = () => {
    sessionStorage.removeItem('intento_plan')
    window.location.href = '/goal/new'
  }

  if (!plan) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  // Format step name to human readable
  const formatStepName = (name: string) =>
    name.replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

  // Format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}m ${s}s` : `${m} minutes`
  }

  const complexityConfig: any = {
    low:    { label: 'Simple',   color: 'text-[#10B981]', bg: 'bg-[#10B981]/10 border-[#10B981]/30' },
    medium: { label: 'Moderate', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30' },
    high:   { label: 'Complex',  color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10 border-[#EF4444]/30' }
  }

  const complexity = plan.complexity?.complexity || 'low'
  const config = complexityConfig[complexity] || complexityConfig.low
  const steps = plan.steps || []
  const layers = plan.layers || []
  const totalTime = steps.reduce(
    (sum: number, s: any) => sum + (s.est_time_sec || 0), 0
  )

  // Priority badge
  const priorityLabel = (p: string) => {
    if (p === 'critical') return { label: 'Important', color: 'text-[#EF4444] bg-[#EF4444]/10' }
    if (p === 'high')     return { label: 'High',      color: 'text-[#F59E0B] bg-[#F59E0B]/10' }
    return                       { label: 'Normal',    color: 'text-[#94A3B8] bg-[#2D2D44]' }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto page-enter">

        {/* Back */}
        <button
          onClick={() => window.location.href = '/goal/new'}
          className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Goal
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Your Action Plan
          </h1>
          <p className="text-[#94A3B8] text-sm leading-relaxed">
            {plan.goal_text}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-4 text-center card-hover">
            <p className="text-2xl font-bold text-white">{steps.length}</p>
            <p className="text-xs text-[#94A3B8] mt-1">Action Steps</p>
          </div>
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-4 text-center card-hover">
            <p className="text-2xl font-bold text-white">
              {formatTime(totalTime)}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">Est. Time</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${config.bg}`}>
            <p className={`text-2xl font-bold ${config.color}`}>
              {config.label}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">Difficulty</p>
          </div>
        </div>

        {/* Parallel note */}
        {layers.some((l: number[]) => l.length > 1) && (
          <div className="flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl px-4 py-3 mb-5">
            <Zap className="w-4 h-4 text-[#7C3AED] flex-shrink-0" />
            <p className="text-sm text-[#7C3AED]">
              Some steps will run simultaneously to save time.
            </p>
          </div>
        )}

        {/* Steps — Human Friendly */}
        <div className="space-y-3 mb-8">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            What the AI will do
          </h2>

          {steps.map((step: any, index: number) => {
            const p = priorityLabel(step.priority)
            // Find if this step runs in parallel with another
            const layer = layers.find((l: number[]) => l.includes(step.id))
            const isParallel = layer && layer.length > 1

            return (
              <div
                key={step.id}
                className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-4 card-hover step-animate"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="flex items-start gap-3">
                  {/* Step number */}
                  <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#7C3AED]">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Step name — human readable */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">
                        {formatStepName(step.action)}
                      </p>
                      {isParallel && (
                        <span className="text-xs bg-[#7C3AED]/20 text-[#7C3AED] px-2 py-0.5 rounded-full border border-[#7C3AED]/30">
                          Parallel
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.color}`}>
                        {p.label}
                      </span>
                    </div>

                    {/* Human-friendly description */}
                    <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Time estimate */}
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-[#94A3B8]" />
                      <span className="text-xs text-[#94A3B8]">
                        About {formatTime(step.est_time_sec || 30)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* What you'll get */}
        <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">
            What you'll receive
          </h3>
          <div className="space-y-2">
            {[
              'A complete, personalized action plan',
              'Step-by-step breakdown you can follow immediately',
              'AI-verified results with confidence scores',
              'Downloadable report (JSON / Markdown)'
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] flex-shrink-0" />
                <p className="text-sm text-[#94A3B8]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold py-4 rounded-xl transition btn-glow disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run This Plan
              </>
            )}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="px-5 bg-[#1A1A2E] border border-[#2D2D44] text-[#94A3B8] hover:text-white rounded-xl transition disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

      </div>
    </AppLayout>
  )
}
