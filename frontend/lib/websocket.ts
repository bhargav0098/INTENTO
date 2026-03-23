const RECONNECT_DELAY = 2000
const MAX_ATTEMPTS = 5

export class ExecutionWebSocket {
  private ws: WebSocket | null = null
  private goalId: string
  private attempts: number = 0
  private onMessage: (data: unknown) => void
  private onStatusChange: (status: string) => void
  private pollingInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    goalId: string,
    onMessage: (data: unknown) => void,
    onStatusChange: (status: string) => void
  ) {
    this.goalId = goalId
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange
    this.connect()
  }

  connect() {
    // Use env variable, fallback to deriving ws:// from the API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const wsBase = process.env.NEXT_PUBLIC_WS_URL ||
      apiUrl.replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/ws/${this.goalId}`

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.attempts = 0
      this.onStatusChange('connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        this.onMessage(data)
      } catch (e) {
        console.error('WS parse error', e)
      }
    }

    this.ws.onclose = () => {
      this.onStatusChange('disconnected')
      this.reconnect()
    }

    this.ws.onerror = () => {
      this.onStatusChange('error')
    }
  }

  reconnect() {
    if (this.attempts >= MAX_ATTEMPTS) {
      this.onStatusChange('failed')
      this.startPolling()
      return
    }
    this.attempts++
    this.onStatusChange('reconnecting')
    setTimeout(() => this.connect(), RECONNECT_DELAY)
  }

  startPolling() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('intento_token') : ''
    this.pollingInterval = setInterval(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(
          `${apiUrl}/execution/status/${this.goalId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        this.onMessage({ type: 'sync_state', execution: data })
        if (['completed', 'aborted', 'failed'].includes(data.execution_status)) {
          this.stopPolling()
        }
      } catch (e) {
        console.error('Polling failed', e)
      }
    }, 3000)
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  disconnect() {
    this.stopPolling()
    this.ws?.close()
  }
}
