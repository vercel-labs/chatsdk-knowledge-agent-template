import { defineClientAuth } from '@onmax/nuxt-better-auth/config'
import { adminClient, apiKeyClient } from 'better-auth/client/plugins'

export default defineClientAuth({
  plugins: [adminClient(), apiKeyClient()],
})
