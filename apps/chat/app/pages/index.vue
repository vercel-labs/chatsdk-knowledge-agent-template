<script setup lang="ts">
definePageMeta({ auth: 'user' })

useSeoMeta({ title: 'New chat' })

const input = ref('')
const loading = ref(false)
const chatId = crypto.randomUUID()

const { model } = useModels()
const { mode } = useChatMode()

const {
  dropzoneRef,
  isDragging,
  files,
  isUploading,
  uploadedFiles,
  addFiles,
  removeFile,
  clearFiles
} = useFileUploadWithStatus(chatId)

async function createChat(prompt: string) {
  input.value = prompt
  loading.value = true

  const parts: Array<{ type: string, text?: string, mediaType?: string, url?: string }> = [{ type: 'text', text: prompt }]

  if (uploadedFiles.value.length > 0) {
    parts.push(...uploadedFiles.value)
  }

  const chat = await $fetch('/api/chats', {
    method: 'POST',
    body: {
      id: chatId,
      mode: mode.value,
      message: {
        role: 'user',
        parts
      }
    }
  })

  refreshNuxtData('chats')
  navigateTo(`/chat/${chat?.id}`)
}

async function onSubmit() {
  await createChat(input.value)
  clearFiles()
}

const chatQuickChats = [
  {
    label: 'What are Nitro tasks and how do I use them in my Nuxt app?',
    icon: 'i-logos-nuxt-icon'
  },
  {
    label: 'How does unstorage work and how can I use it with NuxtHub KV?',
    icon: 'i-logos-unjs'
  },
  {
    label: 'What is H3 readValidatedBody and how to use it in Nuxt server routes?',
    icon: 'i-logos-unjs'
  },
  {
    label: 'How do I configure unhead for SEO in Nuxt with useHead and useSeoMeta?',
    icon: 'i-lucide-search'
  },
  {
    label: 'What are Nitro cache options and how to use them with Nuxt routeRules?',
    icon: 'i-custom-docs'
  },
  {
    label: 'How does ofetch work and what\'s the difference with Nuxt useFetch?',
    icon: 'i-logos-nuxt-icon'
  }
]

const adminQuickChats = [
  {
    label: 'Chart the daily token usage by model over the last 30 days',
    icon: 'i-custom-chart'
  },
  {
    label: 'Show app health: error rate, latency p95, and slowest endpoints',
    icon: 'i-lucide-activity'
  },
  {
    label: 'Are there any production errors in the last 24h? Show the trend',
    icon: 'i-lucide-alert-triangle'
  },
  {
    label: 'Chart active users and message volume over the last 14 days',
    icon: 'i-lucide-users'
  },
  {
    label: 'What are the top 10 most-hit endpoints and their avg latency?',
    icon: 'i-lucide-zap'
  },
  {
    label: 'Show usage stats for the last 7 days with a cost breakdown chart',
    icon: 'i-lucide-coins'
  }
]

const quickChats = computed(() => mode.value === 'admin' ? adminQuickChats : chatQuickChats)
</script>

<template>
  <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <DragDropOverlay :show="isDragging" />
      <UContainer ref="dropzoneRef" class="flex-1 flex flex-col justify-center gap-4 sm:gap-6 py-8">
        <h1 class="text-3xl sm:text-4xl text-highlighted font-bold font-pixel tracking-wide">
          How can I help you today?
        </h1>

        <UChatPrompt
          v-model="input"
          :status="loading ? 'streaming' : 'ready'"
          :disabled="isUploading"
          class="[view-transition-name:chat-prompt]"
          variant="subtle"
          :ui="{ base: 'px-1.5' }"
          @submit="onSubmit"
        >
          <template v-if="files.length > 0" #header>
            <div class="flex flex-wrap gap-2">
              <FileAvatar
                v-for="fileWithStatus in files"
                :key="fileWithStatus.id"
                :name="fileWithStatus.file.name"
                :type="fileWithStatus.file.type"
                :preview-url="fileWithStatus.previewUrl"
                :status="fileWithStatus.status"
                :error="fileWithStatus.error"
                removable
                @remove="removeFile(fileWithStatus.id)"
              />
            </div>
          </template>

          <template #footer>
            <div class="flex items-center gap-1">
              <FileUploadButton @files-selected="addFiles($event)" />
              <ModelSelect v-model="model" />
            </div>

            <UChatPromptSubmit color="neutral" size="sm" :disabled="isUploading" />
          </template>
        </UChatPrompt>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <UButton
            v-for="quickChat in quickChats"
            :key="quickChat.label"
            :icon="quickChat.icon"
            :label="quickChat.label"
            size="sm"
            color="neutral"
            variant="outline"
            class="rounded-full justify-start"
            @click="createChat(quickChat.label)"
          />
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
