// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@nuxthub/core',
    '@onmax/nuxt-better-auth',
    'workflow/nuxt',
    '@evlog/nuxthub',
    'nuxt-charts',
  ],

  auth: {
    redirects: {
      login: '/login',
      guest: '/',
    },
    schema: {
      usePlural: false,
      casing: 'camelCase',
    },
  },

  evlog: {
    retention: '7d',
    env: {
      service: 'savoir',
      version: '0.1.0',
    },
  },

  devtools: { enabled: true },

  $development: {
    vite: {
      server: {
        allowedHosts: true // Allow ngrok and other tunnels
      }
    },
  },

  css: ['~/assets/css/main.css'],

  mdc: {
    headings: {
      anchorLinks: false
    },
    highlight: {
      shikiEngine: 'javascript'
    }
  },

  experimental: {
    viewTransition: true
  },

  icon: {
    customCollections: [
      {
        prefix: 'custom',
        dir: './app/assets/icons/custom',
      },
    ],
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
    },
    provider: 'iconify',
  },

  compatibilityDate: 'latest',

  nitro: {
    experimental: {
      openAPI: true
    }
  },

  hub: {
    db: 'postgresql',
    kv: true,
    blob: true
  },

  routeRules: {
    // Shared chats are read-only, great ISR candidate
    '/shared/**': { isr: { expiration: 300 } },
    // Auth API routes should never be cached
    '/api/auth/**': { isr: false, cache: false },
    // Chat API responses are user-specific
    '/api/chats/**': { isr: false, cache: false },
    // Webhook routes should never be cached
    '/api/webhooks/**': { isr: false, cache: false },
    // Admin pages are behind auth, skip ISR
    '/admin/**': { isr: false, cache: false, auth: { user: { role: 'admin' } } },
  },

  runtimeConfig: {
    // Admin users (comma-separated GitHub emails or usernames)
    adminUsers: '',
    github: {
      token: '',
      snapshotRepo: '',
      snapshotBranch: 'main',
      appId: '',
      appPrivateKey: '',
      webhookSecret: '',
      replyToNewIssues: false,
    },
    discord: {
      botToken: '',
      publicKey: '',
      applicationId: '',
      mentionRoleIds: '',
    },
    youtube: {
      apiKey: '',
    },
    public: {
      siteUrl: '',
      github: {
        botTrigger: '',
      },
    },
  }
})
