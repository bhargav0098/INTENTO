'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import API from '@/lib/api'
import {
  CheckCircle, Circle, MinusCircle,
  Flame, TrendingUp, ChevronRight
} from 'lucide-react'

type Response = 'done' | 'partial' | 'skip' | null

export default function GoalCheckinPage() {
  const { goalId } = useParams()
  const router     = useRouter()

  const [steps,     setSteps]     = useState<any[]>([])
  const [goalText,  setGoalText]  = useState('')
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [mood,      setMood]      = useState<string>('okay')
  const [note,      setNote]      = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result,    setResult]    = useState<any>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    API.get(`/checkin/goal/${goalId}/steps`).then(res => {
      setSteps(res.data.steps)
      setGoalText(res.data.goal_text)
      // Pre-fill if already checked in today
      if (res.data.today_checkin) {
        const prefilled: Record<string, Response> = {}
        Object.entries(res.data.today_checkin).forEach(([k, v]) => {
          prefilled[k] = v as Response
        })
        setResponses(prefilled)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [goalId])

  const setResponse = (stepId: number, value: Response) => {
    setResponses(prev => ({ ...prev, [String(stepId)]: value }))
  }

  const handleSubmit = async () => {
    try {
      const res = await API.post(`/checkin/goal/${goalId}/submit`, {
        step_responses: responses,
        mood,
        note
      })
      setResult(res.data)
      setSubmitted(true)
    } catch (err) {
      alert('Failed to submit. Please try again.')
    }
  }

  const completionPct = () => {
    const total   = steps.length
    if (!total) return 0
    const done    = Object.values(responses).filter(v => v === 'done').length
    const partial = Object.values(responses).filter(v => v === 'partial').length
    return Math.round(((done + partial * 0.5) / total) * 100)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (submitted && result) return (
    <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-[#7C3AED]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Check-in Saved!</h1>
        <p className="text-[#94A3B8] mb-8">Great job showing up today.</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#7C3AED]">{result.completion_score}%</p>
            <p className="text-xs text-[#94A3B8] mt-1">Today</p>
          </div>
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4">
            <p className="text-2xl font-bold text-white">{result.real_progress}%</p>
            <p className="text-xs text-[#94A3B8] mt-1">Overall</p>
          </div>
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-5 h-5 text-orange-400" />
              <p className="text-2xl font-bold text-orange-400">{result.streak}</p>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">Streak</p>
          </div>
        </div>

        <button
          onClick={() => window.location.href = '/dashboard'}
          className="w-full bg-[#7C3AED] text-white py-3 rounded-xl font-semibold"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0D0D1A] p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[#7C3AED] text-sm font-medium mb-1">Daily Check-in</p>
          <h1 className="text-2xl font-bold text-white">{goalText}</h1>
          <p className="text-[#94A3B8] text-sm mt-1">
            Did you complete these steps today?
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#94A3B8]">Today's Progress</span>
            <span className="text-[#7C3AED] font-bold">{completionPct()}%</span>
          </div>
          <div className="h-2 bg-[#2D2D44] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7C3AED] rounded-full transition-all duration-500"
              style={{ width: `${completionPct()}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {steps.map(step => (
            <div
              key={step.id}
              className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4"
            >
              <p className="text-white font-medium mb-3">{step.action}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'done',    label: 'Done',    icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400 border-green-400/50 bg-green-400/10' },
                  { value: 'partial', label: 'Partial', icon: <MinusCircle className="w-4 h-4" />, color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' },
                  { value: 'skip',    label: 'Skipped', icon: <Circle className="w-4 h-4" />,      color: 'text-red-400 border-red-400/50 bg-red-400/10' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setResponse(step.id, opt.value as Response)}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border transition text-sm font-medium
                      ${responses[String(step.id)] === opt.value
                        ? opt.color
                        : 'text-[#94A3B8] border-[#2D2D44] hover:border-[#7C3AED]/50'
                      }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mood */}
        <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 mb-4">
          <p className="text-white font-medium mb-3">How did it feel?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'great', label: 'Great',  color: 'text-green-400  border-green-400/50  bg-green-400/10'  },
              { value: 'okay',  label: 'Okay',   color: 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' },
              { value: 'hard',  label: 'Hard',   color: 'text-red-400    border-red-400/50    bg-red-400/10'    }
            ].map(m => (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                className={`py-2 rounded-xl border transition text-sm font-medium
                  ${mood === m.value
                    ? m.color
                    : 'text-[#94A3B8] border-[#2D2D44] hover:border-[#7C3AED]/50'
                  }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Any notes for today? (optional)"
          className="w-full bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 text-white placeholder-[#94A3B8] text-sm resize-none mb-6 focus:outline-none focus:border-[#7C3AED]"
          rows={3}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={Object.keys(responses).length === 0}
          className="w-full bg-[#7C3AED] disabled:opacity-40 text-white py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2"
        >
          Save Check-in
          <ChevronRight className="w-5 h-5" />
        </button>

      </div>
    </div>
  )
}
