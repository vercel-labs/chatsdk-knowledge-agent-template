<script setup lang="ts">
import type { DefineComponent } from 'vue'
import PreStream from '../../../components/prose/PreStream.vue'
import content from '../../../content/docs/sdk.md?raw'

useSeoMeta({ title: 'SDK - Admin' })

const components = {
  pre: PreStream as unknown as DefineComponent,
}
</script>

<template>
  <div class="px-6 py-8 max-w-3xl mx-auto w-full">
    <div class="prose prose-sm prose-neutral dark:prose-invert max-w-none">
      <MDCCached
        :value="content"
        cache-key="docs-sdk"
        :components
        :parser-options="{ highlight: false }"
      />
    </div>
  </div>
</template>
