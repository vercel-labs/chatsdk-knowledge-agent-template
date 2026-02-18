<script setup lang="ts">
import { motion } from 'motion-v'
import { useIntervalFn, useRafFn } from '@vueuse/core'
import type { ToolCall } from '#shared/types/tool-call'

const props = defineProps<{
  text?: string
  toolCalls?: ToolCall[]
  isLoading?: boolean
  animated?: boolean
}>()

const messages = [
  'Exploring the sources',
  'Searching for content',
  'Looking for relevant files',
  'Analyzing the results',
  'Finding the best answer',
  'Checking related resources',
  'Almost there',
]

const finishedMessage = 'Done'
const chars = 'abcdefghijklmnopqrstuvwxyz'

const currentIndex = ref(0)
const displayedText = ref('')

const targetText = computed(() => {
  if (!props.isLoading) return finishedMessage
  return props.text || messages[currentIndex.value]
})

let frame = 0
const totalFrames = 15
let fromText = ''
let toText = ''

const { pause: pauseScramble, resume: resumeScramble } = useRafFn(() => {
  frame++
  const maxLength = Math.max(fromText.length, toText.length)
  let result = ''

  for (let i = 0; i < maxLength; i++) {
    const progress = frame / totalFrames
    const charProgress = progress * maxLength

    if (i < charProgress - 2) {
      result += toText[i] || ''
    } else if (i < charProgress) {
      result += chars[Math.floor(Math.random() * chars.length)]
    } else {
      result += fromText[i] || ''
    }
  }

  displayedText.value = result

  if (frame >= totalFrames) {
    displayedText.value = toText
    pauseScramble()
  }
}, { immediate: false })

function scrambleText(from: string, to: string) {
  fromText = from
  toText = to
  frame = 0
  resumeScramble()
}

watch(targetText, (newText, oldText) => {
  if (newText !== oldText && newText && oldText) {
    scrambleText(oldText, newText)
  }
}, { immediate: true })

onMounted(() => {
  displayedText.value = targetText.value || ''
})

const { pause, resume } = useIntervalFn(() => {
  currentIndex.value = (currentIndex.value + 1) % messages.length
}, 3500, { immediate: false })

watch(() => props.isLoading, (isLoading) => {
  if (isLoading && !props.text) {
    resume()
  } else {
    pause()
  }
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-2 mb-4">
    <div class="flex items-center text-sm text-muted overflow-hidden">
      <motion.div
        v-if="isLoading"
        :initial="{ opacity: 1, width: 'auto' }"
        :exit="{ opacity: 0, width: 0 }"
        :transition="{ duration: 0.2 }"
        class="shrink-0 mr-2.5"
      >
        <ChatMatrix :size="5" :dot-size="1.5" :gap="1.5" />
      </motion.div>
      <motion.span
        :animate="{ x: 0 }"
        :transition="{ duration: 0.2 }"
        class="font-mono tracking-tight"
      >
        {{ displayedText }}
      </motion.span>
    </div>

    <div
      v-if="toolCalls?.length"
      class="flex flex-col gap-0.5"
      :class="isLoading ? 'pl-[28px]' : 'pl-0'"
    >
      <ToolCallItem
        v-for="tool in toolCalls"
        :key="tool.toolCallId"
        :tool
        :animated
      />
    </div>
  </div>
</template>
