<script setup lang="ts">
import content from '../../../content/docs/discord-bot.md?raw'

useSeoMeta({ title: 'Discord Bot - Admin' })

const tocLinks = useMarkdownToc(content)
</script>

<template>
  <div class="px-6 py-8 max-w-3xl mx-auto w-full">
    <div class="prose prose-sm prose-neutral dark:prose-invert max-w-none">
      <Comark :markdown="content" />
    </div>
  </div>

  <Teleport to="#doc-toc-target" defer>
    <div class="w-56 py-8 pl-5 pr-8">
      <DocToc :links="tocLinks" />
    </div>
  </Teleport>
</template>
