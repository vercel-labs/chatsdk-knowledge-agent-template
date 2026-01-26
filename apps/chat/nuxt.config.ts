// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@nuxthub/core',
    'nuxt-auth-utils',
    'workflow/nuxt',
    'evlog/nuxt',
  ],

  evlog: {
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

  compatibilityDate: 'latest',

  nitro: {
    experimental: {
      openAPI: true
    }
  },

  hub: {
    db: 'sqlite',
    kv: true,
    blob: true
  },

  runtimeConfig: {
    // Savoir SDK config
    savoir: {
      apiKey: '',
      secretKey: '',
    },
    // GitHub config
    github: {
      token: '',
      snapshotRepo: '',
      snapshotBranch: 'main',
      appId: '',
      appPrivateKey: '',
      webhookSecret: '',
    },
    public: {
      github: {
        botTrigger: '@nuxt-agent',
      },
    },
  }
})
