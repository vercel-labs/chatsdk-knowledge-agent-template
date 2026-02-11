export type ChatMode = 'chat' | 'admin'

const mode = ref<ChatMode>('chat')

export function useChatMode() {
  const { isAdmin } = useAdmin()

  const isAdminMode = computed(() => mode.value === 'admin')

  function setMode(newMode: ChatMode) {
    if (newMode === 'admin' && !isAdmin.value) return
    mode.value = newMode
  }

  watch(isAdmin, (admin) => {
    if (!admin && mode.value === 'admin') {
      mode.value = 'chat'
    }
  })

  return {
    mode: readonly(mode),
    isAdminMode,
    setMode,
  }
}
