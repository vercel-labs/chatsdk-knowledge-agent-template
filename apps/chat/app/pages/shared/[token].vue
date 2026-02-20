<script setup lang="ts">
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

const { data, error } = await useFetch(`/api/shared/${route.params.token}`, {
  getCachedData: (key, nuxtApp) =>
    nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
})

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Shared chat not found'
  })
}

useSeoMeta({
  title: data.value?.title || 'Shared Chat'
})

definePageMeta({
  layout: false
})

const scrollRef = ref<HTMLElement>()
const showTopFade = ref(false)
const showBottomFade = ref(true)

function updateFades() {
  const el = scrollRef.value
  if (!el) return
  showTopFade.value = el.scrollTop > 8
  showBottomFade.value = el.scrollTop + el.clientHeight < el.scrollHeight - 8
}

onMounted(() => {
  const el = scrollRef.value
  if (!el) return
  el.addEventListener('scroll', updateFades, { passive: true })
  const ro = new ResizeObserver(updateFades)
  ro.observe(el)
  nextTick(() => requestAnimationFrame(updateFades))

  onUnmounted(() => {
    el.removeEventListener('scroll', updateFades)
    ro.disconnect()
  })
})
</script>

<template>
  <div class="h-dvh bg-default flex flex-col overflow-hidden">
    <!-- Fixed navbar -->
    <header class="shrink-0 z-20 bg-default border-b border-default">
      <div class="max-w-5xl mx-auto flex items-center justify-between px-4 h-12">
        <NuxtLink to="/" class="flex items-center gap-2">
          <UIcon name="i-custom-savoir" class="size-6 text-primary" />
          <span class="text-lg font-bold font-pixel tracking-wide text-highlighted">Savoir</span>
        </NuxtLink>

        <div v-if="data?.title" class="hidden sm:flex items-center gap-2 text-sm text-muted truncate max-w-sm">
          <UAvatar
            v-if="data.author?.image"
            :src="data.author.image"
            :alt="data.author?.name"
            size="2xs"
          />
          <span class="truncate">{{ data.title }}</span>
        </div>

        <UButton
          label="Start your own chat"
          to="/"
          color="primary"
          size="xs"
        />
      </div>
    </header>

    <!-- Main content panel — fixed container, internal scroll -->
    <div class="flex-1 flex flex-col m-2 min-h-0">
      <div class="flex-1 flex flex-col rounded-xl ring ring-default bg-muted shadow-sm min-h-0 overflow-hidden relative">
        <!-- Scroll fade indicators -->
        <div
          class="pointer-events-none absolute top-0 inset-x-0 h-12 bg-linear-to-b from-muted to-transparent z-10"
        />
        <div
          class="pointer-events-none absolute bottom-10 inset-x-0 h-16 bg-linear-to-t from-muted to-transparent z-10 transition-opacity duration-150"
          :class="showBottomFade ? 'opacity-100' : 'opacity-0'"
        />

        <div ref="scrollRef" class="flex-1 overflow-y-auto">
          <UContainer class="flex flex-col">
            <UChatMessages
              :messages="data?.messages || []"
              status="ready"
              class="pt-4 sm:pt-6 pb-4 sm:pb-6"
            >
              <template #content="{ message }">
                <template v-for="(part, index) in message.parts.filter(p => p.type !== 'data-sources')" :key="`${message.id}-${part.type}-${index}-${part.type.startsWith('tool-') ? (part as any).state ?? '' : ''}`">
                  <Reasoning
                    v-if="part.type === 'reasoning'"
                    :text="part.text"
                    :is-streaming="false"
                  />
                  <Comark
                    v-else-if="part.type === 'text' && message.role === 'assistant'"
                    :markdown="part.text"
                    class="*:first:mt-0 *:last:mb-0"
                  />
                  <p v-else-if="part.type === 'text' && message.role === 'user'" class="whitespace-pre-wrap">
                    {{ part.text }}
                  </p>
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
          </UContainer>
        </div>

        <!-- Bottom CTA — fixed at bottom of card -->
        <div class="shrink-0 border-t border-default px-4 py-3">
          <p class="text-center text-sm text-muted">
            Read-only shared chat.
            <NuxtLink to="/" class="text-primary hover:underline font-medium">
              Start your own conversation
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
