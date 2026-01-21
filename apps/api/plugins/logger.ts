import { definePlugin } from 'nitro'
import { initLogger } from '~/lib/logger'

/**
 * Initialize the logger when the server starts
 */
export default definePlugin(() => {
  initLogger()
})
