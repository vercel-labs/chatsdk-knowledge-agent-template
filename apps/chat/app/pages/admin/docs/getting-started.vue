<script setup lang="ts">
import type { DefineComponent } from 'vue'
import PreStream from '../../../components/prose/PreStream.vue'
import content from '../../../content/docs/getting-started.md?raw'

useSeoMeta({ title: 'Getting Started - Admin' })

const components = {
  pre: PreStream as unknown as DefineComponent,
}

const tocLinks = useMarkdownToc(content)
</script>

<template>
  <div class="px-6 py-8 max-w-3xl mx-auto w-full">
    <div class="prose prose-sm prose-neutral dark:prose-invert max-w-none">
      <MDCCached
        :value="content"
        cache-key="docs-getting-started"
        :components
        :parser-options="{ highlight: false }"
      />
    </div>
  </div>

  <Teleport to="#doc-toc-target" defer>
    <div class="w-56 py-8 pl-5 pr-8">
      <DocToc :links="tocLinks" />
    </div>
  </Teleport>
</template>
