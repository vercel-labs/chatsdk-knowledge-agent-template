import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './',

  modules: ['workflow/nitro'],

  storage: {
    kv: {
      driver: 'vercel-kv',
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
