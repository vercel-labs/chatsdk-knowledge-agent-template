import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './',

  modules: ['workflow/nitro'],

  storage: {
    kv: {
      driver: 'fs',
      base: '.data/kv',
    },
  },

  $production: {
    storage: {
      kv: {
        driver: 'upstash',
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      },
    },
  },

  runtimeConfig: {
    // GitHub token for API access
    githubToken: process.env.GITHUB_TOKEN || '',

    // Snapshot repository (owner/repo format)
    snapshotRepo: process.env.GITHUB_SNAPSHOT_REPO || '',

    // Snapshot branch (default: main)
    snapshotBranch: process.env.GITHUB_SNAPSHOT_BRANCH || 'main',

    // API secret key for authentication
    savoirSecretKey: process.env.SAVOIR_SECRET_KEY || '',
  },
})
