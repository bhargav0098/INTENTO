import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('intento_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = 'Network error. Check your connection and make sure the backend is running.'
      return Promise.reject(error)
    }

    if (error.response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('intento_token')
      localStorage.removeItem('intento_user')
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }

    const detail = error.response.data?.detail
    if (Array.isArray(detail)) {
      error.response.data.message = detail
        .map((d: { msg?: string; message?: string }) => d.msg || d.message)
        .join(', ')
    } else if (typeof detail === 'string') {
      error.response.data.message = detail
    } else if (typeof detail === 'object' && detail?.message) {
      error.response.data.message = detail.message
    }

    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data: Record<string, string>) => API.post('/auth/register', data),
  login: (data: Record<string, string>) => API.post('/auth/login', data),
  me: () => API.get('/auth/me'),
  deleteAccount: () => API.delete('/auth/delete-account'),
  changePassword: (data: Record<string, string>) => API.put('/auth/change-password', data)
}

export const executionAPI = {
  start:   (data: Record<string, unknown>) => API.post('/execution/start', data),
  approve: (id: string) => API.post(`/execution/approve/${id}`),
  status:  (id: string) => API.get(`/execution/status/${id}`),
  pause:   (id: string) => API.post(`/execution/pause/${id}`),
  stop:    (id: string) => API.post(`/execution/stop/${id}`),
  revert:  (id: string, version: number) =>
    API.post(`/execution/revert/${id}`, { version })
}

export const progressAPI = {
  checkin: (data: Record<string, unknown>) => API.post('/progress/checkin', data),
  goalProgress: (goalId: string) => API.get(`/progress/goal/${goalId}`),
  stressHistory: () => API.get('/progress/stress/history'),
  currentStress: (goalId: string) => API.get(`/progress/stress/current/${goalId}`),
  analytics: (period: string) => API.get(`/progress/analytics?period=${period}`),
  goalHistory: (search?: string, status?: string) =>
    API.get(`/progress/goals/history?search=${search || ''}&status=${status || 'all'}`),
  burnoutDiff: (goalId: string) => API.get(`/progress/burnout/diff/${goalId}`),
  acceptBurnout: (data: Record<string, unknown>) => API.post('/progress/burnout/accept', data),
  undoBurnout: (data: Record<string, unknown>) => API.post('/progress/burnout/undo', data)
}

export const goalsAPI = {
  list: () => API.get('/goals/'),
  get: (goalId: string) => API.get(`/goals/${goalId}`),
  export: (goalId: string, format: string) => API.get(`/goals/${goalId}/export?format=${format}`),
  delete: (goalId: string) => API.delete(`/goals/${goalId}`)
}

export default API
