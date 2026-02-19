<script setup lang="ts">
import { motion, AnimatePresence } from 'motion-v'
import { useTimeoutFn } from '@vueuse/core'
import type { ToolCall } from '#shared/types/tool-call'

const props = defineProps<{
  tool: ToolCall
  animated?: boolean
}>()

const isExpanded = ref(false)
const displayedLabel = ref('')

const fullLabel = computed(() => {
  const { toolName, args, state, result } = props.tool

  // Bash tools: args.command / args.commands drives the title.
  // Admin tools: no command in args — fall back to result.commands[0].title (set in yield output).
  // The `command` field drives the $ prompt line; `title` drives the bullet label.
  const firstResultCmd = result?.commands?.[0]
  const commands = (args?.commands as string[] | undefined)
    || (args?.command ? [args.command as string] : undefined)
    || (firstResultCmd?.title ? [firstResultCmd.title] : firstResultCmd?.command ? [firstResultCmd.command] : [])

  if (toolName === 'search_web') {
    const query = args?.query || '...'
    return state === 'loading' ? `Web search: "${query}"` : `Web search: "${query}"`
  }

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
    if (state === 'loading') return 'Running...'
    // Tool-specific fallback from args when result.commands isn't available (historical messages)
    if (toolName === 'run_sql') {
      const q = args?.query as string | undefined
      return q ? (q.length > 80 ? `${q.slice(0, 80)}…` : q) : 'SQL query'
    }
    // Generic fallback: humanize the tool name (e.g. 'log_stats' → 'Log stats')
    return toolName.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
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

  // For non-shell commands (e.g. admin tool labels), return the full text
  return firstPart.length > 60 ? `${firstPart.slice(0, 60)}…` : firstPart || 'command'
}

let typewriterTimeout: ReturnType<typeof setTimeout> | null = null

function typewrite(text: string, index = 0) {
  if (index <= text.length) {
    displayedLabel.value = text.slice(0, index)
    typewriterTimeout = setTimeout(() => typewrite(text, index + 1), 20)
  }
}

watch(fullLabel, (newLabel) => {
  if (!props.animated) {
    displayedLabel.value = newLabel
    return
  }
  if (typewriterTimeout) clearTimeout(typewriterTimeout)
  if (newLabel.length > displayedLabel.value.length) {
    typewrite(newLabel, displayedLabel.value.length)
  } else {
    displayedLabel.value = newLabel
  }
}, { immediate: true })

const commandsToShow = computed(() => {
  const { args, result, toolName } = props.tool

  if (result?.commands?.length) {
    return result.commands
  }

  // Bash tools: fall back to args.command / args.commands
  const bashCmds = args?.commands as string[] || (args?.command ? [args.command as string] : [])
  if (bashCmds.length) {
    return bashCmds.map(cmd => ({ command: cmd, stdout: '', stderr: '', exitCode: 0, success: true }))
  }

  // Admin tools: synthesize from call args so the expand button is still useful
  const entries = Object.entries(args ?? {}).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length) {
    const stdout = entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n')
    return [{ command: '', title: toolName.replace(/_/g, ' '), stdout, stderr: '', exitCode: 0, success: true }]
  }

  return []
})

const canExpand = computed(() => {
  const { args, state } = props.tool
  if (state === 'loading') return !!(args?.commands || args?.command)
  return commandsToShow.value.length > 0
})

const { start: startExpand, stop: stopExpand } = useTimeoutFn(() => {
  isExpanded.value = true
}, 150, { immediate: false })

const { start: startCollapse, stop: stopCollapse } = useTimeoutFn(() => {
  isExpanded.value = false
}, 2000, { immediate: false })

watch(() => props.tool.state, (newState, oldState) => {
  if (!canExpand.value || !props.animated) return

  stopExpand()
  stopCollapse()

  if (newState === 'loading' && oldState !== 'loading') {
    startExpand()
  } else if (newState === 'done' && oldState === 'loading') {
    // If loading was too brief for the 150ms expand timer to fire, expand now
    if (!isExpanded.value) {
      isExpanded.value = true
    }
    startCollapse()
  } else if (newState === 'done' && oldState === undefined) {
    // Tool arrived with loading+done batched in the same tick (fast admin tools)
    isExpanded.value = true
    startCollapse()
  }
}, { immediate: true })

onUnmounted(() => {
  if (typewriterTimeout) clearTimeout(typewriterTimeout)
  stopExpand()
  stopCollapse()
})

function truncateOutput(text: string, maxLines = 8): string {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length <= maxLines) return lines.join('\n')
  return `${lines.slice(0, maxLines).join('\n')}\n··· ${lines.length - maxLines} more lines`
}
</script>

<template>
  <motion.div
    :initial="animated ? { opacity: 0, x: -4 } : false"
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
          class="animate-ping absolute inline-flex size-full rounded-full bg-current opacity-75"
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
        v-if="isExpanded && canExpand"
        key="expanded"
        :initial="{ height: 0, opacity: 0 }"
        :animate="{ height: 'auto', opacity: 1 }"
        :exit="{ height: 0, opacity: 0 }"
        :transition="{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }"
        class="overflow-hidden"
      >
        <div v-if="commandsToShow.length" class="ml-2.5 pl-1.5 border-l border-muted/15 mt-0.5 mb-1 space-y-1">
          <div
            v-for="(cmd, idx) in commandsToShow"
            :key="idx"
            class="space-y-0.5"
          >
            <div v-if="cmd.command" class="flex items-start gap-1 text-[10px]">
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
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.div>
</template>
