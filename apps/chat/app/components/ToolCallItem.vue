<script setup lang="ts">
import { motion, AnimatePresence } from 'motion-v'
import { useTimeoutFn } from '@vueuse/core'

interface CommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

interface ToolExecutionResult {
  commands: CommandResult[]
  success: boolean
  durationMs: number
  error?: string
}

interface ToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: 'loading' | 'done' | 'error'
  result?: ToolExecutionResult
}

const props = defineProps<{
  tool: ToolCall
}>()

const isExpanded = ref(false)
const displayedLabel = ref('')

const fullLabel = computed(() => {
  const { toolName, args, state } = props.tool
  const commands = args?.commands as string[] || (args?.command ? [args.command as string] : [])

  if (toolName === 'search_and_read') {
    const query = args?.query || '...'
    return state === 'loading' ? `Searching "${query}"` : `Searched "${query}"`
  }

  if (toolName === 'read') {
    const paths = args?.paths as string[] | undefined
    const path = paths?.[0]?.split('/').pop() || '...'
    return state === 'loading' ? `Reading ${path}` : `Read ${path}`
  }

  if (!commands.length) {
    return state === 'loading' ? 'Running...' : 'Done'
  }

  const summaries = commands.slice(0, 2).map(summarizeCommand)
  const suffix = commands.length > 2 ? ` +${commands.length - 2}` : ''
  return `${summaries.join(', ')}${suffix}`
})

function summarizeCommand(cmd: string): string {
  const trimmed = cmd.trim()
  const firstPart = (trimmed.split('|')[0] ?? '').trim()

  if (firstPart.startsWith('grep ') || firstPart.startsWith('rg ')) {
    const match = trimmed.match(/(?:grep|rg)\s+(?:-[a-zA-Z]+\s+)*["']?([^"'\s|]+)["']?/)
    return match ? `grep "${match[1]}"` : 'grep'
  }
  if (firstPart.startsWith('find ')) {
    const nameMatch = trimmed.match(/-name\s+["']?([^"'\s]+)["']?/)
    return nameMatch ? `find ${nameMatch[1]}` : 'find'
  }
  if (firstPart.startsWith('cat ') || firstPart.startsWith('head ') || firstPart.startsWith('tail ')) {
    const pathMatch = firstPart.match(/(?:cat|head|tail)\s+(?:-[a-zA-Z0-9]+\s+)*(.+)/)
    const fileName = pathMatch?.[1]?.trim().split('/').pop() || 'file'
    return `read ${fileName}`
  }
  if (firstPart.startsWith('ls ')) {
    const pathMatch = firstPart.match(/ls\s+(?:-[a-zA-Z]+\s+)*(.*)/)
    const path = pathMatch?.[1]?.trim() || '.'
    const dirName = path === '.' ? 'docs' : path.split('/').pop()
    return `ls ${dirName}`
  }

  const [cmdName] = firstPart.split(/\s+/)
  return cmdName || 'command'
}

let typewriterTimeout: ReturnType<typeof setTimeout> | null = null

function typewrite(text: string, index = 0) {
  if (index <= text.length) {
    displayedLabel.value = text.slice(0, index)
    typewriterTimeout = setTimeout(() => typewrite(text, index + 1), 20)
  }
}

watch(fullLabel, (newLabel) => {
  if (typewriterTimeout) clearTimeout(typewriterTimeout)
  if (newLabel.length > displayedLabel.value.length) {
    typewrite(newLabel, displayedLabel.value.length)
  } else {
    displayedLabel.value = newLabel
  }
}, { immediate: true })

const canExpand = computed(() => {
  const { args, result } = props.tool
  return args?.commands || args?.command || result?.commands?.length
})

const { start: startExpand, stop: stopExpand } = useTimeoutFn(() => {
  isExpanded.value = true
}, 150, { immediate: false })

const { start: startCollapse, stop: stopCollapse } = useTimeoutFn(() => {
  isExpanded.value = false
}, 2000, { immediate: false })

watch(() => props.tool.state, (newState, oldState) => {
  if (!canExpand.value) return

  stopExpand()
  stopCollapse()

  if (newState === 'loading' && oldState !== 'loading') {
    startExpand()
  } else if (newState === 'done' && oldState === 'loading') {
    startCollapse()
  }
}, { immediate: true })

onUnmounted(() => {
  if (typewriterTimeout) clearTimeout(typewriterTimeout)
  stopExpand()
  stopCollapse()
})

const commandsToShow = computed(() => {
  const { args, result } = props.tool

  if (result?.commands?.length) {
    return result.commands
  }

  const cmds = args?.commands as string[] || (args?.command ? [args.command as string] : [])
  return cmds.map(cmd => ({
    command: cmd,
    stdout: '',
    stderr: '',
    exitCode: 0,
    success: true,
  }))
})

function truncateOutput(text: string, maxLines = 8): string {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length <= maxLines) return lines.join('\n')
  return `${lines.slice(0, maxLines).join('\n')}\n··· ${lines.length - maxLines} more lines`
}
</script>

<template>
  <motion.div
    :initial="{ opacity: 0, x: -4 }"
    :animate="{ opacity: 1, x: 0 }"
    :transition="{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }"
  >
    <button
      class="flex items-center gap-1.5 w-full text-left group rounded -mx-1 px-1 outline-none focus-visible:ring-1 focus-visible:ring-muted/30"
      :class="[
        canExpand ? 'cursor-pointer hover:bg-muted/5' : 'cursor-default',
        isExpanded && 'bg-muted/5',
      ]"
      :tabindex="canExpand ? 0 : -1"
      @click="canExpand && (isExpanded = !isExpanded)"
    >
      <span class="relative flex size-1 shrink-0">
        <span
          v-if="tool.state === 'loading'"
          class="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"
        />
        <span
          class="relative inline-flex rounded-full size-1 bg-current"
          :class="tool.state === 'loading' ? 'opacity-100' : 'opacity-40'"
        />
      </span>

      <span class="text-[11px] text-dimmed font-mono flex-1 truncate leading-tight">
        {{ displayedLabel }}<span v-if="tool.state === 'loading'" class="animate-pulse">_</span>
      </span>

      <span
        v-if="tool.result?.durationMs && tool.state === 'done'"
        class="text-[9px] text-muted/40 tabular-nums"
      >
        {{ tool.result.durationMs }}ms
      </span>

      <motion.span
        v-if="canExpand"
        :animate="{ rotate: isExpanded ? 180 : 0 }"
        :transition="{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }"
      >
        <UIcon name="i-lucide-chevron-down" class="size-2.5 text-muted/40" />
      </motion.span>
    </button>

    <AnimatePresence>
      <motion.div
        v-if="isExpanded && commandsToShow.length"
        :initial="{ height: 0, opacity: 0 }"
        :animate="{ height: 'auto', opacity: 1 }"
        :exit="{ height: 0, opacity: 0 }"
        :transition="{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }"
        class="overflow-hidden"
      >
        <div class="ml-2.5 pl-1.5 border-l border-muted/15 mt-0.5 mb-1 space-y-1">
          <div
            v-for="(cmd, idx) in commandsToShow"
            :key="idx"
            class="space-y-0.5"
          >
            <div class="flex items-start gap-1 text-[10px]">
              <span class="text-muted/50 font-mono shrink-0">$</span>
              <code class="text-muted/70 font-mono break-all leading-tight">{{ cmd.command }}</code>
            </div>

            <div
              v-if="cmd.stdout || cmd.stderr"
              class="bg-muted/5 rounded px-1.5 py-1 font-mono text-[9px] text-dimmed/60 overflow-x-auto max-h-32 overflow-y-auto"
            >
              <pre v-if="cmd.stdout" class="whitespace-pre-wrap leading-tight">{{ truncateOutput(cmd.stdout) }}</pre>
              <pre v-if="cmd.stderr" class="whitespace-pre-wrap text-muted/50 mt-0.5 leading-tight">{{ truncateOutput(cmd.stderr, 3) }}</pre>
            </div>

            <div
              v-else-if="tool.state === 'loading'"
              class="text-[9px] text-muted/40 italic"
            >
              running...
            </div>

            <div
              v-else-if="tool.state === 'done' && tool.result"
              class="text-[9px] text-muted/25 italic"
            >
              (no output)
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.div>
</template>
