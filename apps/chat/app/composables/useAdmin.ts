export function useAdmin() {
  const { user } = useUserSession()
  const isAdmin = computed(() => user.value?.role === 'admin')
  return { isAdmin }
}
