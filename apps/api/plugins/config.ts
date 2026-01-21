import { definePlugin } from 'nitro'
import { setConfigCwd } from '@savoir/config'

/**
 * Set the config directory at startup.
 */
export default definePlugin(() => {
  // Config is at the project root (parent of apps/api)
  setConfigCwd(process.cwd().replace(/\/apps\/api$/, ''))
})
