'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { executionAPI } from '@/lib/api'
import { ExecutionWebSocket } from '@/lib/websocket'
import { Pause, Play, Square, Brain, Wifi, WifiOff, RefreshCw, Layers, Zap } from 'lucide-react'

const statusIcon: any = { completed: '✅', executing: '⏳', pending: '⬜', failed: '❌' }
const priorityLabel: any = { critical: '🔴', normal: '🟡', optional: '🟢' }

export default function LiveExecution() {
  const { goalId } = useParams()
  const router = useRouter()
  const [execution, setExecution] = useState<any>(null)
  const [thoughts, setThoughts] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState('connecting')
  const [steps, setSteps] = useState<any[]>([])
  const [percentage, setPercentage] = useState<number>(0)
  const [currentLayer, setCurrentLayer] = useState(0)
  const [totalLayers,  setTotalLayers]  = useState(0)
  const wsRef = useRef<ExecutionWebSocket | null>(null)
  const thoughtsRef = useRef<HTMLDivElement>(null)

  const refresh = () => {
    executionAPI.status(goalId as string).then(res => {
      setExecution(res.data)
      setSteps(res.data.steps || [])
      setPercentage(res.data.percentage || 0)
    }).catch(() => {})
  }

  useEffect(() => {
    if (!goalId) return

    const fetchStatus = async () => {
      try {
        const res = await executionAPI.status(goalId as string)
        const data = res.data
        setExecution(data)
        setSteps(data.steps || [])
        setPercentage(data.percentage || 0)
        if (data.current_layer) setCurrentLayer(data.current_layer)
        if (data.total_layers)  setTotalLayers(data.total_layers)

        if (
          data.execution_status === 'completed' ||
          data.execution_status === 'failed' ||
          data.execution_status === 'aborted'
        ) {
          setTimeout(() => {
            window.location.href = `/results/${goalId}`
          }, 1500)
        }
      } catch (err) {
        console.error('Status fetch error:', err)
      }
    }

    // Fetch immediately
    fetchStatus()

    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000)

    // WebSocket
    const ws = new ExecutionWebSocket(
      goalId as string,
      (msg) => {
        if (msg.type === 'execution_complete') {
          clearInterval(interval)
          setTimeout(() => {
            window.location.href = `/results/${goalId}`
          }, 1500)
        }
        if (
          msg.type === 'step_update' ||
          msg.type === 'progress_update' ||
          msg.type === 'sync_state' ||
          msg.type === 'layer_start' ||
          msg.type === 'layer_complete'
        ) {
          fetchStatus()
        }
        if (msg.type === 'thought') {
          setThoughts(prev => [...prev.slice(-4), msg.content])
        }
      },
      (status) => setWsStatus(status)
    )

    return () => {
      clearInterval(interval)
      ws.disconnect()
    }
  }, [goalId])

  useEffect(() => {
    if (thoughtsRef.current) thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight
  }, [thoughts])

  const [paused, setPaused] = useState(false)

  const handlePause = async () => {
    try {
      const res = await executionAPI.pause(goalId as string)
      setPaused(res.data.status === 'paused')
      refresh()
    } catch (err) {
      console.error('Pause failed:', err)
    }
  }

  const handleStop = async () => {
    if (confirm('Stop this execution? Partial results will be saved.')) {
      await executionAPI.stop(goalId as string)
      router.push('/dashboard')
    }
  }

  const wsStatusStyle = wsStatus === 'connected'
    ? 'border-[#10B981]/30 text-[#10B981] bg-[#10B981]/10'
    : wsStatus === 'reconnecting'
       ? 'border-[#F59E0B]/30 text-[#F59E0B] bg-[#F59E0B]/10'
       : 'border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/10'

  const pct = Math.round(percentage || 0)

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto page-enter">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-[#7C3AED]" />
              <h1 className="text-xl font-black text-white">LIVE EXECUTION</h1>
            </div>
            <p className="text-[#94A3B8] text-sm line-clamp-1 max-w-md">{execution?.goal_text}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${wsStatusStyle}`}>
              {wsStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wsStatus}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">Execution Progress</p>
              <p className="text-sm text-[#94A3B8] mt-0.5">
                Layer {currentLayer} of {totalLayers || execution?.steps?.length || '?'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-white count-animate">{pct}<span className="text-xl text-[#94A3B8]">%</span></p>
            </div>
          </div>
          <div className="w-full bg-[#0A0A0F] rounded-full h-3 mb-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#7C3AED] to-[#9F67FF] h-3 rounded-full transition-all duration-700 relative overflow-hidden bar-animate"
              style={{ width: `${pct}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-[#4B5563]">
            <span>{execution?.completed_steps || 0}/{steps?.length || 0} steps done</span>
            <span>🔁 {execution?.replans || 0} replans</span>
            <span>📋 {execution?.version || 'v1.0'}</span>
          </div>
        </div>

        {/* Agent Status Row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {['Planner', 'Executor', 'Verifier', 'Critic'].map((agent) => (
            <div key={agent} className="bg-[#12121A] border border-[#2D2D44] rounded-xl p-3 text-center card-hover">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Brain className="w-4 h-4 text-[#7C3AED]" />
                <p className="text-xs text-white font-medium">{agent}</p>
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
                <span className="text-[10px] text-[#10B981]">Active</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step list */}
        <div className="bg-[#12121A] border border-[#2D2D44] rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#7C3AED]" /> Execution Steps
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {steps?.length > 0 ? steps.map((step: any, index: number) => (
              <div key={step.id}
                className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors step-animate ${step.status === 'executing' ? 'bg-[#7C3AED]/10 border border-[#7C3AED]/30' : 'hover:bg-[#0A0A0F]'}`}
                style={{ animationDelay: `${index * 0.05}s` }}>
                <span className="text-base flex-shrink-0">{statusIcon[step.status] || '⬜'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#4B5563]">#{step.id}</span>
                    <p className="text-sm text-white font-medium truncate">{step.action}</p>
                    <span className="ml-auto text-xs">{priorityLabel[step.priority]}</span>
                  </div>
                  {step.result?.result?.summary && (
                    <p className="text-xs text-[#94A3B8] mt-0.5 truncate">↳ {step.result.result.summary}</p>
                  )}
                </div>
                {step.confidence != null && (
                  <span className={`text-xs flex-shrink-0 font-mono ${step.confidence >= 0.75 ? 'text-[#10B981]' : step.confidence >= 0.5 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                    {Math.round(step.confidence * 100)}%
                  </span>
                )}
              </div>
            )) : (
              <p className="text-sm text-[#4B5563] text-center py-4">Loading steps...</p>
            )}
          </div>
        </div>

        {/* Thought stream */}
        <div className="bg-[#12121A] border border-[#7C3AED]/30 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-white">Agent Thinking</h3>
            <div className="w-1.5 h-1.5 bg-[#7C3AED] rounded-full animate-ping ml-auto" />
          </div>
          <div ref={thoughtsRef} className="space-y-2 max-h-28 overflow-y-auto">
            {thoughts.length === 0 ? (
              <p className="text-xs text-[#4B5563] italic">Waiting for agent activity...</p>
            ) : thoughts.map((thought, i) => (
              <p
                key={i}
                className="thought-animate text-xs text-[#94A3B8] leading-relaxed border-l-2 border-[#7C3AED]/30 pl-2"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {thought}
              </p>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button onClick={handlePause} className="flex items-center gap-2 bg-[#1A1A2E] border border-[#2D2D44] text-[#94A3B8] hover:text-white px-5 py-3 rounded-xl transition-colors">
            {paused
              ? <><Play className="w-4 h-4" /> Resume</>
              : <><Pause className="w-4 h-4" /> Pause</>
            }
          </button>
          <button onClick={handleStop} className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20 px-5 py-3 rounded-xl transition-colors">
            <Square className="w-4 h-4" /> Stop
          </button>
          <button onClick={refresh} className="ml-auto flex items-center gap-2 bg-[#1A1A2E] border border-[#2D2D44] text-[#94A3B8] hover:text-white px-5 py-3 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
