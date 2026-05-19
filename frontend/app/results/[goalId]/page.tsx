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
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    executionAPI.status(goalId as string)
      .then(res => setExecution(res.data))
      .finally(() => setLoading(false))
  }, [goalId])

  const formatStepName = (name: string) =>
    name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const handleRerun = async () => {
    try {
      router.push('/goal/new')
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const token = localStorage.getItem('intento_token')
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const url = `${apiBase}/goals/export/${goalId}?format=pdf`

      const res = await fetch(url, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        let msg = `Server error: ${res.status}`
        try {
          const json = await res.json()
          msg = json.detail || json.error || msg
        } catch (_) {}
        throw new Error(msg)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf')) {
        throw new Error('Server did not return a PDF file')
      }

      const blob = await res.blob()
      if (blob.size === 0) throw new Error('Received empty PDF file')

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'intento-plan.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    } catch (err: any) {
      setDownloadError(err.message || 'Download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadMD = async () => {
    try {
      const token = localStorage.getItem('intento_token')
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiBase}/goals/export/${goalId}?format=md`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'intento-plan.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    } catch (err) {
      setDownloadError('Markdown download failed. Please try again.')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#94A3B8]">Loading results...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!execution) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#94A3B8] mb-4">Results not found.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-[#7C3AED] text-white px-6 py-2 rounded-xl"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const steps = execution.steps || []
  const evaluation = execution.evaluation || {}
  const isCompleted = execution.execution_status === 'completed'

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#0D0D1A] px-4 py-8 max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isCompleted ? 'bg-[#7C3AED]/20' : 'bg-red-500/20'}`}>
            {isCompleted ? (
              <Trophy className="w-8 h-8 text-[#7C3AED]" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isCompleted ? 'Plan Complete!' : 'Plan Ended'}
          </h1>
          <p className="text-[#94A3B8] text-sm max-w-md mx-auto line-clamp-2">
            {execution.goal_text}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: CheckCircle, label: 'Completed', value: `${steps.filter((s: any) => s.status === 'completed').length}/${steps.length}`, color: 'text-green-400' },
            { icon: Clock, label: 'Time', value: execution.time_taken || 'N/A', color: 'text-blue-400' },
            { icon: Star, label: 'Confidence', value: `${Math.round((evaluation.confidence_score || 0.9) * 100)}%`, color: 'text-yellow-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-3 text-center">
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
              <p className="text-white font-semibold text-sm">{value}</p>
              <p className="text-[#64748B] text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 mb-4">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#7C3AED]" />
            Execution Steps
          </h2>
          <div className="space-y-2">
            {steps.map((step: any, i: number) => (
              <div key={i} className="border border-[#2D2D44] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-[#2D2D44]/50 transition"
                >
                  <div className="flex items-center gap-2">
                    {step.status === 'completed'
                      ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    }
                    <span className="text-white text-sm font-medium">
                      Step {i + 1}: {formatStepName(step.action || '')}
                    </span>
                  </div>
                  {expanded === i
                    ? <ChevronDown className="w-4 h-4 text-[#64748B]" />
                    : <ChevronRight className="w-4 h-4 text-[#64748B]" />
                  }
                </button>
                {expanded === i && (
                  <div className="px-4 pb-3 border-t border-[#2D2D44] pt-3">
                    <p className="text-[#94A3B8] text-xs whitespace-pre-wrap break-words">
                      {typeof step.result === 'string'
                        ? step.result
                        : step.result?.output || step.result?.summary || step.result?.content || JSON.stringify(step.result, null, 2) || 'No output'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        {evaluation.optimization_suggestions?.length > 0 && (
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 mb-4">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              AI Suggestions
            </h2>
            <div className="space-y-2">
              {evaluation.optimization_suggestions.map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-[#94A3B8]">{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Download error */}
        {downloadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm">{downloadError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center justify-center gap-2 bg-[#1A1A2E] border border-[#2D2D44] text-[#94A3B8] hover:text-white py-3 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <div className="w-4 h-4 border border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="text-sm">{downloading ? 'Downloading...' : 'Download PDF'}</span>
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
            <span className="text-sm">New Goal</span>
          </button>
        </div>

        {/* New goal button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-[#1A1A2E] border border-[#2D2D44] text-[#64748B] hover:text-white py-3 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Back to Dashboard</span>
        </button>

      </div>
    </AppLayout>
  )
}
