<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'

const appConfig = useAppConfig()
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

useSnapshotSync()

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en',
  },
})

useHead({
  titleTemplate: `%s - ${appConfig.app.name}`
})

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string
const ogImage = siteUrl ? `${siteUrl.replace(/\/$/, '')}/og.jpg` : '/og.jpg'

useSeoMeta({
  title: appConfig.app.name,
  description: appConfig.app.description,
  ogTitle: appConfig.app.name,
  ogDescription: appConfig.app.description,
  ogImage,
  twitterImage: ogImage,
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }" :tooltip="{ delayDuration: 200 }">
    <NuxtLoadingIndicator color="var(--ui-primary)" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- To enable Vercel Analytics, uncomment: -->
    <!-- <Analytics /> -->
  </UApp>
</template>
