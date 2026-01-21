import { defineHandler } from 'nitro/h3'

/**
 * GET /api
 * API health check and information
 */
export default defineHandler(() => {
  return {
    name: 'Savoir API',
    version: '0.1.0',
    endpoints: {
      sources: {
        list: 'GET /api/sources',
      },
      sync: {
        all: 'POST /api/sync',
        one: 'POST /api/sync/:source',
      },
    },
  }
})
