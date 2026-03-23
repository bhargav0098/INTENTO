'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { executionAPI } from '@/lib/api'
import {
  Download, RotateCcw, Plus,
  CheckCircle, XCircle, ChevronDown,
  ChevronRight, Trophy, Clock,
  GitBranch, Star, Play
} from 'lucide-react'

export default function Results() {
  const { goalId } = useParams()
  const router = useRouter()
  const [execution, setExecution] = useState<any>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    executionAPI.status(goalId as string)
      .then(res => setExecution(res.data))
      .finally(() => setLoading(false))
  }, [goalId])

  const formatStepName = (name: string) =>
    name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const handleRerun = async () => {
    try {
      // Get current goal text
      const goalText = execution?.goal_text
      if (!goalText) {
        window.location.href = '/goal/new'
        return
      }

      // Start new execution with same goal
      const res = await executionAPI.start({
        goal_text: goalText,
        priority: execution?.priority || 'high'
      })

      if (res.data?.goal_id) {
        sessionStorage.setItem('intento_plan', JSON.stringify(res.data))
        window.location.href = '/goal/preview'
      }
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
        'Failed to rerun. Please try again.'
      )
    }
  }

  const getRawOutput = (step: any): string => {
    const candidates = [
      step?.result?.result?.output,
      step?.result?.output,
      step?.result?.result?.summary,
      step?.result?.summary,
    ]

    for (const raw of candidates) {
      if (!raw) continue
      let text = String(raw).trim()
      if (!text || text === 'None' || text === '{}') continue

      // Strip dict wrapper if present
      if (text.startsWith("{'") || text.startsWith('{"')) {
        try {
          const fixed = text.replace(/'/g, '"')
          const parsed = JSON.parse(fixed)
          const inner = parsed.output || parsed.summary || ''
          if (inner) text = String(inner).trim()
        } catch {
          // Try regex extraction
          const match = text.match(/['"]output['"]\s*:\s*['"]([\s\S]+?)['"]\s*,/)
          if (match) text = match[1]
        }
      }

      if (text && text.length > 10) return text
    }

    return 'No output recorded.'
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  if (!execution) return null

  const steps     = execution.steps || []
  const completed = steps.filter((s: any) => s.status === 'completed')
  const failed    = steps.filter((s: any) => s.status === 'failed')
  const evaluation = execution.evaluation

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto page-enter">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#7C3AED]/20 border border-[#7C3AED]/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-[#7C3AED]" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {execution.execution_status === 'completed'
              ? 'Goal Completed!'
              : 'Execution Finished'
            }
          </h1>
          <p className="text-[#94A3B8] mt-2 text-sm max-w-md mx-auto">
            {execution.goal_text}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Time',      value: execution.time_taken || 'N/A' },
            { label: 'Completed', value: completed.length },
            { label: 'Failed',    value: failed.length },
            { label: 'Replans',   value: execution.replans || 0 }
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Step Results — with actual content */}
        <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-white mb-4">Results</h3>
          <div className="space-y-3">
            {steps.map((step: any, i: number) => {
              const isExpanded = expanded === step.id

              return (
                <div
                  key={step.id}
                  className="border border-[#2D2D44] rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : step.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0A0A0F]/50 transition"
                  >
                    {step.status === 'completed'
                      ? <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                      : <XCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        {formatStepName(step.action)}
                      </p>
                      {!isExpanded && (
                        <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                          {getRawOutput(step).slice(0, 100)}...
                        </p>
                      )}
                    </div>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                    }
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#2D2D44] pt-3 animate-fade-in">
                      <p className="text-sm text-[#F1F5F9] leading-relaxed whitespace-pre-wrap">
                        {getRawOutput(step)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Evaluation */}
        {evaluation && (
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-[#7C3AED]" />
              <h3 className="font-semibold text-white">AI Self-Evaluation</h3>
              <span className="ml-auto text-xs bg-[#7C3AED]/20 text-[#7C3AED] px-2 py-0.5 rounded-full border border-[#7C3AED]/30">
                {evaluation.overall_rating}
              </span>
            </div>
            {[
              { label: 'Efficiency', value: evaluation.efficiency_score },
              { label: 'Confidence', value: evaluation.confidence_score }
            ].map((m) => (
              <div key={m.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#94A3B8]">{m.label}</span>
                  <span className="text-white font-medium">
                    {Math.round((m.value || 0) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-[#0A0A0F] rounded-full h-2">
                  <div
                    className="bg-[#7C3AED] h-2 rounded-full bar-animate"
                    style={{ width: `${(m.value || 0) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {evaluation.optimization_suggestions?.length > 0 && (
              <div className="mt-3 space-y-1">
                {evaluation.optimization_suggestions.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] mt-1.5 flex-shrink-0" />
                    <p className="text-xs text-[#94A3B8]">{s}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('intento_token')
                const res = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/goals/export/${goalId}?format=pdf`,
                  {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  }
                )
                if (!res.ok) throw new Error('Download failed')
                const blob = await res.blob()
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a')
                a.href     = url
                a.download = 'intento-plan.pdf'
                a.click()
                URL.revokeObjectURL(url)
              } catch (err) {
                alert('Download failed. Please try again.')
              }
            }}
            className="flex items-center justify-center gap-2 bg-[#1A1A2E] border border-[#2D2D44] text-[#94A3B8] hover:text-white py-3 rounded-xl transition"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Download PDF</span>
          </button>
          <button
            onClick={() => router.push(`/checkin/${goalId}`)}
            className="flex items-center justify-center gap-2 bg-[#7C3AED] text-white py-3 rounded-xl transition hover:bg-[#6D28D9]"
          >
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">Daily Check-in</span>
          </button>
          <button
            onClick={handleRerun}
            className="flex items-center justify-center gap-2 bg-[#1A1A2E] border border-[#2D2D44] text-[#94A3B8] hover:text-white py-3 rounded-xl transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Rerun</span>
          </button>
          <button
            onClick={() => window.location.href = '/goal/new'}
            className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3 rounded-xl transition btn-glow"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Goal</span>
          </button>
        </div>

      </div>
    </AppLayout>
  )
}
