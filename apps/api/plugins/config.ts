import { definePlugin } from 'nitro'
import { setStaticConfig } from '@savoir/config'
// @ts-expect-error - alias defined in nitro.config.ts
import savoirConfig from '#savoir-config'

/**
 * Initialize config at startup.
 * Uses bundled config (works in serverless where filesystem isn't available).
 */
export default definePlugin(() => {
  const config = savoirConfig.default ?? savoirConfig
  setStaticConfig(config)
})
