export default defineNuxtRouteMiddleware(() => {
  const { user, loggedIn } = useUserSession()
  if (!loggedIn.value || user.value?.role !== 'admin') {
    return navigateTo('/')
  }
})
