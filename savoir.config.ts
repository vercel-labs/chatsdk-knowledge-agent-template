import { defineConfig } from '@savoir/config'

export default defineConfig({
  sources: {
    github: [
      // Nuxt Core
      {
        id: 'nuxt',
        label: 'Nuxt',
        repo: 'nuxt/nuxt',
        additionalSyncs: [
          { repo: 'nuxt/nuxt.com', contentPath: 'content' },
        ],
      },
      {
        id: 'nitro',
        label: 'Nitro',
        repo: 'nitrojs/nitro',
        branch: 'v3',
      },

      // Nuxt Modules
      { id: 'nuxt-ui', label: 'Nuxt UI', repo: 'nuxt/ui', branch: 'v4', contentPath: 'docs/content' },
      { id: 'nuxt-hub', label: 'NuxtHub', repo: 'nuxt-hub/core', contentPath: 'docs/content' },
      { id: 'nuxt-content', label: 'Nuxt Content', repo: 'nuxt/content', contentPath: 'docs/content' },
      { id: 'nuxt-image', label: 'Nuxt Image', repo: 'nuxt/image', contentPath: 'docs/content' },
      { id: 'nuxt-i18n', label: 'Nuxt i18n', repo: 'nuxt-modules/i18n', contentPath: 'docs/content' },
      { id: 'nuxt-scripts', label: 'Nuxt Scripts', repo: 'nuxt/scripts', contentPath: 'docs/content' },
      { id: 'nuxt-fonts', label: 'Nuxt Fonts', repo: 'nuxt/fonts', contentPath: 'docs/content' },
      { id: 'nuxt-eslint', label: 'Nuxt ESLint', repo: 'nuxt/eslint', contentPath: 'docs/content' },
      { id: 'nuxt-devtools', label: 'Nuxt DevTools', repo: 'nuxt/devtools', contentPath: 'docs/content' },
      { id: 'mcp-toolkit', label: 'MCP Toolkit', repo: 'nuxt-modules/mcp-toolkit', contentPath: 'apps/docs/content' },
      { id: 'nuxt-studio', label: 'Nuxt Studio', repo: 'nuxt-content/nuxt-studio' },

      // README-only
      { id: 'nuxt-icon', label: 'Nuxt Icon', repo: 'nuxt/icon', readmeOnly: true },
      { id: 'nuxt-auth-utils', label: 'Nuxt Auth Utils', repo: 'atinux/nuxt-auth-utils', readmeOnly: true },
      { id: 'ofetch', label: 'ofetch', repo: 'unjs/ofetch', readmeOnly: true },
      { id: 'nuxt-a11y', label: 'Nuxt a11y', repo: 'nuxt/a11y', readmeOnly: true },
      { id: 'nuxt-hints', label: 'Nuxt Hints', repo: 'nuxt/hints', readmeOnly: true },

      // UnJS
      { id: 'h3', label: 'H3', repo: 'unjs/h3' },
      { id: 'unstorage', label: 'unstorage', repo: 'unjs/unstorage' },
      { id: 'unhead', label: 'Unhead', repo: 'unjs/unhead' },

      // SEO
      { id: 'nuxt-og-image', label: 'Nuxt OG Image', repo: 'nuxt-modules/og-image', contentPath: 'docs/content' },
      { id: 'nuxt-sitemap', label: 'Nuxt Sitemap', repo: 'nuxt-modules/sitemap', contentPath: 'docs/content' },
      { id: 'nuxt-robots', label: 'Nuxt Robots', repo: 'nuxt-modules/robots', contentPath: 'docs/content' },
    ],

    youtube: [
      { id: 'alex-lichter', label: 'Alexander Lichter', channelId: 'UCqFPgMzGbLjd-MX-h3Z5aQA', handle: '@TheAlexLichter', maxVideos: 100 },
      { id: 'learn-vue', label: 'LearnVue', channelId: 'UCGwuxdEeCf0TIA2RbPOj-8g', handle: '@LearnVue', maxVideos: 50 },
    ],
  },
})
