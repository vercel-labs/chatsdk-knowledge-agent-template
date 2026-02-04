<script setup lang="ts">
import type { DefineComponent } from 'vue'
import ProseStreamPre from '../../components/prose/PreStream.vue'

const components = {
  pre: ProseStreamPre as unknown as DefineComponent
}

const route = useRoute()

function getFileName(url: string): string {
  try {
    const urlObj = new URL(url)
    const { pathname } = urlObj
    const filename = pathname.split('/').pop() || 'file'
    return decodeURIComponent(filename)
  } catch {
    return 'file'
  }
}

interface Source {
  category: string
  file?: string
}

interface DataSourcesPart {
  type: 'data-sources'
  data: { sources: Source[] }
}

const { data, error } = await useFetch(`/api/shared/${route.params.token}`)

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Shared chat not found'
  })
}

useHead({
  title: data.value?.title || 'Shared Chat | Savoir'
})

definePageMeta({
  layout: false
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <UDashboardPanel id="shared-chat" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <div class="flex items-center gap-3">
              <NuxtLink to="/" class="flex items-end gap-0.5">
                <Logo class="h-8 w-auto shrink-0" />
                <span class="text-xl font-bold text-highlighted">Savoir</span>
              </NuxtLink>
            </div>
          </template>

          <template #center>
            <div class="flex items-center gap-2">
              <UAvatar
                v-if="data?.author.avatar"
                :src="data.author.avatar"
                :alt="data.author.name"
                size="xs"
              />
              <span class="text-sm text-muted">
                {{ data?.title || 'Untitled' }}
                <template v-if="data?.author.name">
                  by {{ data.author.name }}
                </template>
              </span>
            </div>
          </template>

          <template #trailing>
            <UButton
              label="Start your own chat"
              to="/"
              color="primary"
              size="sm"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <UContainer class="flex-1 flex flex-col gap-4 sm:gap-6">
          <UChatMessages
            :messages="data?.messages || []"
            status="ready"
            class="pt-4 sm:pt-6 pb-4 sm:pb-6"
          >
            <template #content="{ message }">
              <template v-for="(part, index) in message.parts.filter(p => p.type !== 'data-sources')" :key="`${message.id}-${part.type}-${index}`">
                <Reasoning
                  v-if="part.type === 'reasoning'"
                  :text="part.text"
                  :is-streaming="false"
                />
                <MDCCached
                  v-else-if="part.type === 'text' && message.role === 'assistant'"
                  :value="part.text"
                  :cache-key="`${message.id}-${index}`"
                  :components
                  :parser-options="{ highlight: false }"
                  class="*:first:mt-0 *:last:mb-0"
                />
                <p v-else-if="part.type === 'text' && message.role === 'user'" class="whitespace-pre-wrap">
                  {{ part.text }}
                </p>
                <ToolWeather
                  v-else-if="part.type === 'tool-weather'"
                  :invocation="(part as WeatherUIToolInvocation)"
                />
                <ToolChart
                  v-else-if="part.type === 'tool-chart'"
                  :invocation="(part as ChartUIToolInvocation)"
                />
                <FileAvatar
                  v-else-if="part.type === 'file'"
                  :name="getFileName(part.url)"
                  :type="part.mediaType"
                  :preview-url="part.url"
                />
              </template>
              <template v-for="(part, index) in (message.parts.filter(p => p.type === 'data-sources') as DataSourcesPart[])" :key="`${message.id}-sources-${index}`">
                <SourceChips
                  :sources="part.data.sources"
                />
              </template>
            </template>
          </UChatMessages>

          <div class="sticky bottom-0 bg-default/75 backdrop-blur p-4 text-center border-t border-muted/20">
            <p class="text-sm text-muted">
              This is a shared chat in read-only mode.
              <NuxtLink to="/" class="text-primary hover:underline">
                Start your own conversation
              </NuxtLink>
            </p>
          </div>
        </UContainer>
      </template>
    </UDashboardPanel>
  </div>
</template>
