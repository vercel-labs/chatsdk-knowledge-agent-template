export default defineNuxtConfig({
  modules: ['@nuxthub/core'],

  hub: {
    kv: true,
  },

  devtools: { enabled: true },

  // Disable type generation to avoid Nuxt 4.3.0 bug with sharedTsConfig
  // See: https://github.com/nuxt/nuxt/issues/33579
  typescript: {
    typeCheck: false,
  },

  $development: {
    vite: {
      server: {
        allowedHosts: true // Allow ngrok and other tunnels
      }
    },
  },

  runtimeConfig: {
    github: {
      webhookSecret: '',
      appId: '',
      appPrivateKey: '',
      replyToNewIssues: false,
    },
    savoir: {
      apiUrl: 'http://localhost:3000',
      apiKey: '',
    },
    public: {
      botTrigger: '',
    },
  },

  compatibilityDate: 'latest',
})
