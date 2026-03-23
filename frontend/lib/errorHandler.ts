export const handleApiError = (error: any): string => {
  if (!error.response) {
    return 'Network error. Check your connection.'
  }
  const status = error.response.status
  const message = error.response.data?.message

  const errorMap: Record<number, string> = {
    400: message || 'Invalid request',
    401: 'Session expired. Please login again.',
    403: "You don't have permission for this.",
    404: 'Resource not found.',
    409: '⚠️ Execution in progress. Stop it first.',
    422: 'Invalid input data.',
    429: 'Daily limit reached. Try again tomorrow.',
    500: 'Server error. Please try again.',
    503: 'Server busy. Please wait and retry.'
  }
  return errorMap[status] || message || 'Something went wrong.'
}

export const showErrorToast = (message: string, setToast: Function) => {
  setToast({ show: true, type: 'error', message })
  setTimeout(() => setToast({ show: false, type: 'info', message: '' }), 3000)
}
