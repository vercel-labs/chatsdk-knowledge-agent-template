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
    routes: {
      '/api/admin/**': { service: 'admin-api' },
      '/api/webhooks/**': { service: 'webhook-api' },
      '/api/sync/**': { service: 'sync-api' },
      '/api/sandbox/**': { service: 'sandbox-api' },
      '/api/stats/**': { service: 'stats-api' },
    },
    transport: { enabled: true },
  },

  $production: {
    evlog: {
      sampling: {
        rates: {
          debug: 0,
          info: 10,
          warn: 50,
        },
        keep: [
          { status: 400 },
          { duration: 2000 },
          { path: '/api/webhooks/**' },
          { path: '/api/sandbox/**' },
        ],
      },
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
    blob: true,
    cache: true
  },

  ssr: false,

  routeRules: {
    // Login page: SSR for fast first paint
    '/login': { ssr: true },
    // Shared chats: SSR + ISR for public access and SEO
    '/shared/**': { ssr: true, isr: { expiration: 300 } },
    // Auth API routes should never be cached
    '/api/auth/**': { isr: false, cache: false },
    // Chat API responses are user-specific
    '/api/chats/**': { isr: false, cache: false },
    // Webhook routes should never be cached
    '/api/webhooks/**': { isr: false, cache: false },
    // Admin pages are behind auth
    '/admin/**': { auth: { user: { role: 'admin' } } },
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
        appName: '',
        botTrigger: '',
      },
      discordBotUrl: '',
    },
  }
})
