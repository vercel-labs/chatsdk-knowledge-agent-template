import { defineClientAuth } from '@onmax/nuxt-better-auth/config'
import { adminClient } from 'better-auth/client/plugins'

export default defineClientAuth({
  plugins: [adminClient()],
})
