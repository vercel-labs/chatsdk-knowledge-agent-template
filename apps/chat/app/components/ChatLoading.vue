<script setup lang="ts">
import { motion } from 'motion-v'

interface ToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: 'loading' | 'done'
}

const props = defineProps<{
  text?: string
  toolCalls?: ToolCall[]
  isLoading?: boolean
}>()

const messages = [
  'Searching the documentation',
  'Reading through the docs',
  'Looking for relevant files',
  'Analyzing the content',
  'Finding the best answer',
  'Checking related resources',
  'Almost there',
]

const finishedMessage = 'Search done'

const currentIndex = ref(0)
const targetText = computed(() => {
  if (!props.isLoading) {
    return finishedMessage
  }
  return props.text || messages[currentIndex.value]
})
const displayedText = ref(targetText.value)

const chars = 'abcdefghijklmnopqrstuvwxyz'

function scrambleText(from: string, to: string) {
  const maxLength = Math.max(from.length, to.length)
  let frame = 0
  const totalFrames = 15

  const animate = () => {
    frame++
    let result = ''

    for (let i = 0; i < maxLength; i++) {
      const progress = frame / totalFrames
      const charProgress = progress * maxLength

      if (i < charProgress - 2) {
        result += to[i] || ''
      } else if (i < charProgress) {
        result += chars[Math.floor(Math.random() * chars.length)]
      } else {
        result += from[i] || ''
      }
    }

    displayedText.value = result

    if (frame < totalFrames) {
      requestAnimationFrame(animate)
    } else {
      displayedText.value = to
    }
  }

  requestAnimationFrame(animate)
}

let textInterval: ReturnType<typeof setInterval> | null = null

watch(targetText, (newText, oldText) => {
  if (newText !== oldText && newText && oldText) {
    scrambleText(oldText, newText)
  }
})

// Stop text rotation when loading finishes
watch(() => props.isLoading, (isLoading) => {
  if (!isLoading && textInterval) {
    clearInterval(textInterval)
    textInterval = null
  }
})

function getToolLabel(tool: ToolCall) {
  const { toolName, args, state } = tool
  const isDone = state === 'done'

  if (toolName === 'search_and_read') {
    return isDone
      ? `Searched "${args?.query || '...'}"`
      : `Searching "${args?.query || '...'}"`
  }

  if (toolName === 'read') {
    const paths = args?.paths as string[] | undefined
    const path = paths?.[0] || '...'
    return isDone
      ? `Read ${path}`
      : `Reading ${path}`
  }

  return toolName
}

onMounted(() => {
  // Text rotation only when loading
  if (!props.text && props.isLoading) {
    textInterval = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % messages.length
    }, 3500)
  }
})

onUnmounted(() => {
  if (textInterval) clearInterval(textInterval)
})
</script>

<template>
  <div class="flex flex-col gap-2 mb-4">
    <!-- Main loader with matrix and text -->
    <div class="flex items-center text-sm text-muted overflow-hidden">
      <motion.div
        v-if="isLoading"
        :initial="{ opacity: 1, width: 'auto' }"
        :exit="{ opacity: 0, width: 0 }"
        :transition="{ duration: 0.2 }"
        class="shrink-0 mr-2.5"
      >
        <ChatMatrix :size="4" :dot-size="3" :gap="3" />
      </motion.div>
      <motion.span
        :animate="{ x: 0 }"
        :transition="{ duration: 0.2 }"
        class="font-mono tracking-tight"
      >
        {{ displayedText }}
      </motion.span>
    </div>

    <!-- Tool calls displayed below -->
    <div
      v-if="toolCalls?.length"
      class="flex flex-col gap-1.5"
      :class="isLoading ? 'pl-[31px]' : 'pl-0'"
    >
      <motion.div
        v-for="tool in toolCalls"
        :key="tool.toolCallId"
        :initial="{ opacity: 0, x: -4 }"
        :animate="{ opacity: 1, x: 0 }"
        :transition="{ duration: 0.15 }"
        class="flex items-center gap-2"
      >
        <span class="size-1.5 rounded-full bg-current opacity-40" />
        <span class="text-xs text-dimmed truncate max-w-[300px]">
          {{ getToolLabel(tool) }}
        </span>
      </motion.div>
    </div>
  </div>
</template>
