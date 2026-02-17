const DISMISS_KEY = 'savoir:install-bot-dismissed'

const dismissed = ref(true)
let initialized = false

export function useInstallBot() {
  const config = useRuntimeConfig()

  if (import.meta.client && !initialized) {
    dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
    initialized = true
  }

  const githubUrl = computed(() => {
    const appName = (config.public.github.appName as string)?.replace(/^@/, '')
    if (!appName) return null
    return `https://github.com/apps/${appName}/installations/new`
  })

  const discordUrl = computed(() => config.public.discordBotUrl || null)

  const hasAny = computed(() => !!githubUrl.value || !!discordUrl.value)

  function dismiss() {
    dismissed.value = true
    localStorage.setItem(DISMISS_KEY, '1')
  }

  function resetDismiss() {
    dismissed.value = false
    localStorage.removeItem(DISMISS_KEY)
  }

  return { dismissed, githubUrl, discordUrl, hasAny, dismiss, resetDismiss }
}
