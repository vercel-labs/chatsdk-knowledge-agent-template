interface ShowErrorOptions {
  fallback?: string
  title?: string
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, any>
    if (e.data?.message) return e.data.message
    if (e.message) return e.message
  }
  if (error instanceof Error) return error.message
  return ''
}

export function useErrorToast() {
  const toast = useToast()

  function showError(error: unknown, options: ShowErrorOptions = {}) {
    const message = extractMessage(error) || options.fallback || 'Something went wrong'
    toast.add({
      title: options.title || 'Error',
      description: message,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
    return message
  }

  return { showError }
}
