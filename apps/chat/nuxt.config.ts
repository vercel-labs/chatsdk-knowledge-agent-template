// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@nuxthub/core',
    'nuxt-auth-utils'
  ],

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
    savoir: {
      apiUrl: '',
      apiKey: '',
    },
    github: {
      token: '',
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
