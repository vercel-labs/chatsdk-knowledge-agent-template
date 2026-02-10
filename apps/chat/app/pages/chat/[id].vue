<script setup lang="ts">
import type { DefineComponent } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { useClipboard } from '@vueuse/core'
import { getTextFromMessage } from '@nuxt/ui/utils/ai'
import ProseStreamPre from '../../components/prose/PreStream.vue'
import type { ToolCall } from '#shared/types/tool-call'

const components = {
  pre: ProseStreamPre as unknown as DefineComponent
}

const route = useRoute()
const toast = useToast()
const clipboard = useClipboard()
const { model } = useModels()

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

const {
  dropzoneRef,
  isDragging,
  files,
  isUploading,
  uploadedFiles,
  addFiles,
  removeFile,
  clearFiles
} = useFileUploadWithStatus(route.params.id as string)

const { data } = await useFetch(`/api/chats/${route.params.id}`, {
  cache: 'force-cache',
  getCachedData: (key, nuxtApp) =>
    nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
})
if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
}

const input = ref('')

const chat = new Chat({
  id: data.value.id,
  messages: data.value.messages,
  transport: new DefaultChatTransport({
    api: `/api/chats/${data.value.id}`,
    body: {
      model: model.value
    }
  }),
  onData: (dataPart) => {
    if (dataPart.type === 'data-chat-title') {
      refreshNuxtData('chats')
    }
  },
  onError(error) {
    const { message } = typeof error.message === 'string' && error.message[0] === '{' ? JSON.parse(error.message) : error
    toast.add({
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0
    })
  }
})

function handleSubmit(e: Event) {
  e.preventDefault()
  if (input.value.trim() && !isUploading.value) {
    chat.sendMessage({
      text: input.value,
      files: uploadedFiles.value.length > 0 ? uploadedFiles.value : undefined
    })
    input.value = ''
    clearFiles()
  }
}

const copied = ref(false)

function copy(_e: MouseEvent, message: UIMessage) {
  clipboard.copy(getTextFromMessage(message))

  copied.value = true

  setTimeout(() => {
    copied.value = false
  }, 2000)
}

type FeedbackType = 'positive' | 'negative' | null
const feedbackMap = shallowRef<Record<string, FeedbackType>>({})

if (data.value?.messages) {
  const initial: Record<string, FeedbackType> = {}
  for (const msg of data.value.messages) {
    const msgWithFeedback = msg as typeof msg & { feedback?: FeedbackType }
    if (msg.role === 'assistant' && msgWithFeedback.feedback) {
      initial[msg.id] = msgWithFeedback.feedback
    }
  }
  feedbackMap.value = initial
}

async function toggleFeedback(_e: MouseEvent, message: UIMessage, type: 'positive' | 'negative') {
  const currentFeedback = feedbackMap.value[message.id] ?? null
  const newFeedback = currentFeedback === type ? null : type

  feedbackMap.value = { ...feedbackMap.value, [message.id]: newFeedback }

  try {
    await $fetch(`/api/messages/${message.id}/feedback`, {
      method: 'PATCH',
      body: { feedback: newFeedback }
    })
  } catch {
    feedbackMap.value = { ...feedbackMap.value, [message.id]: currentFeedback }
    toast.add({
      description: 'Failed to save feedback',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  }
}

function getAssistantActions(message: UIMessage) {
  const feedback = feedbackMap.value[message.id]
  return [
    {
      label: 'Like',
      icon: 'i-lucide-thumbs-up',
      color: feedback === 'positive' ? 'primary' : 'neutral',
      onClick: (e: MouseEvent) => toggleFeedback(e, message, 'positive')
    },
    {
      label: 'Dislike',
      icon: 'i-lucide-thumbs-down',
      color: feedback === 'negative' ? 'error' : 'neutral',
      onClick: (e: MouseEvent) => toggleFeedback(e, message, 'negative')
    },
    {
      label: 'Copy',
      icon: copied.value ? 'i-lucide-copy-check' : 'i-lucide-copy',
      color: 'neutral',
      onClick: copy
    }
  ]
}

function getMessageToolCalls(message: UIMessage): ToolCall[] {
  if (!message?.parts) return []
  return (message.parts as Array<{ type: string, data?: ToolCall }>)
    .filter(p => p.type === 'data-tool-call')
    .map(p => p.data!)
    .filter(Boolean)
}

// Filter out intermediate "thinking out loud" text between tool calls.
// Only keeps text parts that appear after the last tool call (the actual response).
function getContentParts(message: UIMessage) {
  let lastToolIdx = -1
  for (let i = message.parts.length - 1; i >= 0; i--) {
    if ((message.parts[i] as { type: string }).type === 'data-tool-call') {
      lastToolIdx = i
      break
    }
  }
  return message.parts.filter((p, i) => {
    const { type } = p as { type: string }
    if (type === 'data-sources' || type === 'data-tool-call') return false
    if (type === 'text' && message.role === 'assistant' && i <= lastToolIdx) return false
    return true
  })
}

onMounted(() => {
  if (data.value?.messages.length === 1) {
    chat.regenerate()
  }
})

watch(() => chat.status, (newStatus, oldStatus) => {
  if (oldStatus === 'streaming' && newStatus === 'ready') {
    refreshNuxtData('user-stats')
  }
})
</script>

<template>
  <UDashboardPanel id="chat" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <DragDropOverlay :show="isDragging" />
      <UContainer ref="dropzoneRef" class="flex-1 flex flex-col gap-4 sm:gap-6">
        <UChatMessages
          should-auto-scroll
          :messages="chat.messages"
          :status="chat.status"
          :spacing-offset="160"
          class="lg:pt-(--ui-header-height) pb-4 sm:pb-6"
        >
          <template #indicator>
            <ChatLoading :is-loading="true" />
          </template>

          <template #actions="{ message }">
            <template v-if="message.role === 'assistant' && chat.status !== 'streaming'">
              <UButton
                v-for="action in getAssistantActions(message)"
                :key="action.label"
                variant="ghost"
                :color="action.color as any"
                size="xs"
                :icon="action.icon"
                :aria-label="action.label"
                @click="(e: MouseEvent) => action.onClick(e, message)"
              />
            </template>
          </template>

          <template #content="{ message }">
            <ChatLoading
              v-if="message.role === 'assistant' && (chat.status === 'streaming' || getMessageToolCalls(message).length > 0)"
              :tool-calls="getMessageToolCalls(message)"
              :is-loading="chat.status === 'streaming'"
            />
            <template v-for="(part, index) in getContentParts(message)" :key="`${message.id}-${part.type}-${index}${'state' in part ? `-${part.state}` : ''}`">
              <Reasoning
                v-if="part.type === 'reasoning'"
                :text="part.text"
                :is-streaming="part.state !== 'done'"
              />
              <!-- Markdown only for assistant (XSS prevention) -->
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
          </template>
        </UChatMessages>

        <UChatPrompt
          v-model="input"
          :error="chat.error"
          :disabled="isUploading"
          variant="subtle"
          class="sticky bottom-0 [view-transition-name:chat-prompt] rounded-b-none z-10"
          :ui="{ base: 'px-1.5' }"
          @submit="handleSubmit"
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

            <UChatPromptSubmit
              :status="chat.status"
              :disabled="isUploading"
              color="neutral"
              size="sm"
              @stop="chat.stop()"
              @reload="chat.regenerate()"
            />
          </template>
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
