<script setup lang="ts">
import { LazyModalConfirm } from '#components'

useSeoMeta({ title: 'Logs - Admin' })

const toast = useToast()
const overlay = useOverlay()
const { showError } = useErrorToast()
const router = useRouter()

type LogStats = {
  totalCount: number
  oldestLog: string | null
  newestLog: string | null
  levelBreakdown: { level: string | null, count: number }[]
  dailyVolume: { day: string, count: number }[]
}

const { data: stats, refresh, status } = useLazyFetch<LogStats>('/api/admin/logs/stats')

const ALL_LEVELS = ['error', 'warn', 'info', 'debug'] as const

const levelColors: Record<string, string> = {
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
  debug: 'text-muted',
}

const levelIcons: Record<string, string> = {
  info: 'i-lucide-info',
  warn: 'i-lucide-triangle-alert',
  error: 'i-lucide-circle-x',
  debug: 'i-lucide-bug',
}

const normalizedLevels = computed(() => {
  const breakdown = stats.value?.levelBreakdown ?? []
  const map = Object.fromEntries(breakdown.map(r => [r.level ?? 'unknown', r.count]))
  return ALL_LEVELS.map(level => ({ level, count: map[level] ?? 0 }))
})

const errorCount = computed(() => normalizedLevels.value.find(l => l.level === 'error')?.count ?? 0)

// ─── Time unit toggle ────────────────────────────────────────────────────────

type TimeUnit = 'hours' | 'days'
const timeUnit = ref<TimeUnit>('days')

const dayPresets = [
  { label: '1d', value: 1 },
  { label: '3d', value: 3 },
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

const hourPresets = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
  { label: '72h', value: 72 },
]

const activePresets = computed(() => timeUnit.value === 'hours' ? hourPresets : dayPresets)

// ─── Selection state ─────────────────────────────────────────────────────────

const selectedPreset = ref<number | null>(null)
const customValue = ref<number | null>(null)
const selectedLevel = ref<string | null>(null)
const previewCount = ref<number | null>(null)
const isPreviewing = ref(false)
const isDeleting = ref(false)
const isInvestigating = ref(false)

function resetSelection() {
  selectedPreset.value = null
  customValue.value = null
  previewCount.value = null
}

watch(timeUnit, resetSelection)

const activeValue = computed(() => customValue.value ?? selectedPreset.value)

const cutoffDate = computed(() => {
  const v = activeValue.value
  if (!v) return null
  const ms = timeUnit.value === 'hours' ? v * 60 * 60 * 1000 : v * 24 * 60 * 60 * 1000
  return new Date(Date.now() - ms).toISOString()
})

const cutoffLabel = computed(() => {
  if (!cutoffDate.value) return ''
  return new Date(cutoffDate.value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: timeUnit.value === 'hours' ? '2-digit' : undefined,
    minute: timeUnit.value === 'hours' ? '2-digit' : undefined,
  })
})

const unitLabel = computed(() => timeUnit.value === 'hours' ? 'hour' : 'day')

// ─── Chart ───────────────────────────────────────────────────────────────────

const dailyChartData = computed(() => {
  if (!stats.value?.dailyVolume?.length) return []
  const vol = stats.value.dailyVolume
  const maxVal = Math.max(...vol.map(d => d.count), 1)
  return vol.slice(-60).map(d => ({
    day: d.day,
    count: d.count,
    pct: Math.max(2, Math.round((d.count / maxVal) * 100)),
  }))
})

// ─── Delete modal ────────────────────────────────────────────────────────────

const deleteModal = overlay.create(LazyModalConfirm, {
  props: { title: 'Delete logs', description: '' },
})

// ─── Actions ─────────────────────────────────────────────────────────────────

async function runPreview() {
  if (!activeValue.value) return
  isPreviewing.value = true
  try {
    const query: Record<string, string> = { before: cutoffDate.value! }
    if (selectedLevel.value) query.level = selectedLevel.value
    const result = await $fetch<{ count: number }>('/api/admin/logs/count', { query })
    previewCount.value = result.count
  } catch (e) {
    showError(e, { fallback: 'Failed to count logs' })
    resetSelection()
  } finally {
    isPreviewing.value = false
  }
}

function selectPreset(value: number) {
  customValue.value = null
  selectedPreset.value = value
  runPreview()
}

watch(customValue, (val) => {
  if (val && val > 0) {
    selectedPreset.value = null
    runPreview()
  } else if (!val) {
    previewCount.value = null
  }
})

watch(selectedLevel, () => {
  if (activeValue.value) runPreview()
})

async function deleteLogs() {
  if (!cutoffDate.value || previewCount.value === null) return

  const levelLabel = selectedLevel.value ? ` (level: ${selectedLevel.value})` : ''
  const instance = deleteModal.open({
    title: 'Confirm deletion',
    description: `This will permanently delete ${previewCount.value.toLocaleString()} log entries older than ${activeValue.value} ${unitLabel.value}${activeValue.value === 1 ? '' : 's'}${levelLabel}. This cannot be undone.`,
  })
  const confirmed = await instance.result
  if (!confirmed) return

  isDeleting.value = true
  try {
    const body: Record<string, string> = { before: cutoffDate.value }
    if (selectedLevel.value) body.level = selectedLevel.value
    const result = await $fetch<{ deletedCount: number }>('/api/admin/logs', {
      method: 'DELETE',
      body,
    })
    toast.add({ title: `${result.deletedCount.toLocaleString()} logs deleted`, icon: 'i-lucide-check' })
    resetSelection()
    await refresh()
  } catch (e) {
    showError(e, { fallback: 'Failed to delete logs' })
  } finally {
    isDeleting.value = false
  }
}

async function investigateErrors() {
  isInvestigating.value = true
  try {
    const chatId = crypto.randomUUID()
    const messageId = crypto.randomUUID()
    const errorText = errorCount.value > 0
      ? `There are currently **${errorCount.value.toLocaleString()} errors** in production logs`
      : 'There may be errors in production logs'

    await $fetch('/api/chats', {
      method: 'POST',
      body: {
        id: chatId,
        mode: 'admin',
        message: {
          id: messageId,
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `${errorText}. Please investigate — use \`query_errors\` to identify error patterns and \`query_logs\` to dig into the most recent failures. Summarize what's going wrong and suggest next steps.`,
            }
          ],
        },
      },
    })
    refreshNuxtData('chats')
    await router.push(`/chat/${chatId}`)
  } catch (e) {
    showError(e, { fallback: 'Failed to create chat' })
    isInvestigating.value = false
  }
}
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Logs
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Monitor log volume and clean up old entries to free space.
      </p>
    </header>

    <div class="space-y-6">
      <!-- AI error suggestion -->
      <div
        v-if="status !== 'pending' && errorCount > 0"
        class="flex items-center justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UIcon name="i-lucide-circle-x" class="size-4 text-red-500 shrink-0" />
          <p class="text-sm text-highlighted truncate">
            <span class="font-medium tabular-nums">{{ errorCount.toLocaleString() }}</span>
            <span class="text-muted"> error{{ errorCount === 1 ? '' : 's' }} in production logs</span>
          </p>
        </div>
        <UButton
          label="Investigate with AI"
          icon="i-custom-sparkle"
          color="error"
          variant="soft"
          size="xs"
          :loading="isInvestigating"
          class="shrink-0"
          @click="investigateErrors"
        />
      </div>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Overview
        </h2>
        <div class="rounded-lg border border-default p-4 space-y-4">
          <template v-if="status === 'pending'">
            <USkeleton class="h-8 w-40 mb-2" />
            <USkeleton class="h-4 w-56 mb-4" />
            <div class="grid grid-cols-4 gap-2">
              <USkeleton v-for="i in 4" :key="i" class="h-14 rounded-md" />
            </div>
          </template>
          <template v-else-if="stats">
            <div>
              <p class="text-2xl font-medium text-highlighted tabular-nums">
                {{ (stats.totalCount ?? 0).toLocaleString() }}
              </p>
              <p class="text-sm text-muted mt-0.5">
                total log entries
                <template v-if="stats.oldestLog">
                  · from {{ new Date(stats.oldestLog).toLocaleDateString() }}
                  <template v-if="stats.newestLog">
                    to {{ new Date(stats.newestLog).toLocaleDateString() }}
                  </template>
                </template>
              </p>
            </div>

            <!-- Level breakdown — always show all 4 levels -->
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div
                v-for="item in normalizedLevels"
                :key="item.level"
                class="rounded-md bg-elevated px-3 py-2"
              >
                <div class="flex items-center gap-1.5 mb-1">
                  <UIcon
                    :name="levelIcons[item.level]!"
                    :class="[levelColors[item.level], 'size-3']"
                  />
                  <span class="text-[11px] text-muted capitalize">{{ item.level }}</span>
                </div>
                <p class="text-sm font-medium tabular-nums" :class="item.count > 0 ? 'text-highlighted' : 'text-muted'">
                  {{ item.count.toLocaleString() }}
                </p>
              </div>
            </div>

            <!-- Daily volume chart -->
            <div v-if="dailyChartData.length">
              <p class="text-[11px] text-muted mb-2">
                Daily volume (last {{ Math.min(dailyChartData.length, 60) }} days)
              </p>
              <div class="flex items-end gap-px h-12 overflow-hidden rounded">
                <div
                  v-for="d in dailyChartData"
                  :key="d.day"
                  class="flex-1 min-w-0 bg-primary/40 hover:bg-primary/70 transition-colors rounded-sm cursor-default"
                  :style="{ height: `${d.pct}%` }"
                  :title="`${d.day}: ${d.count.toLocaleString()} logs`"
                />
              </div>
            </div>
          </template>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Clean up
        </h2>
        <div class="rounded-lg border border-default p-4 space-y-4">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm text-muted shrink-0">Level:</span>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                label="All"
                size="xs"
                :color="selectedLevel === null ? 'primary' : 'neutral'"
                :variant="selectedLevel === null ? 'solid' : 'ghost'"
                @click="selectedLevel = null"
              />
              <UButton
                v-for="level in ALL_LEVELS"
                :key="level"
                :label="level"
                size="xs"
                :color="selectedLevel === level ? 'primary' : 'neutral'"
                :variant="selectedLevel === level ? 'solid' : 'ghost'"
                class="capitalize"
                @click="selectedLevel = level"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm text-muted shrink-0">Delete older than:</span>
            <div class="flex rounded-md border border-default overflow-hidden">
              <button
                v-for="unit in (['hours', 'days'] as TimeUnit[])"
                :key="unit"
                class="px-3 py-1 text-xs capitalize transition-colors"
                :class="timeUnit === unit ? 'bg-primary text-white' : 'text-muted hover:text-highlighted hover:bg-elevated'"
                @click="timeUnit = unit"
              >
                {{ unit }}
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="preset in activePresets"
              :key="preset.value"
              :label="preset.label"
              size="xs"
              :color="selectedPreset === preset.value && !customValue ? 'primary' : 'neutral'"
              :variant="selectedPreset === preset.value && !customValue ? 'solid' : 'soft'"
              :loading="isPreviewing && selectedPreset === preset.value && !customValue"
              @click="selectPreset(preset.value)"
            />
            <div class="flex items-center gap-1.5">
              <UInput
                v-model="customValue"
                type="number"
                :placeholder="`Custom ${timeUnit === 'hours' ? 'hours' : 'days'}`"
                size="xs"
                :min="1"
                :max="timeUnit === 'hours' ? 8760 : 3650"
                class="w-36"
              />
            </div>
          </div>

          <div
            v-if="previewCount !== null && previewCount !== undefined && activeValue"
            class="flex items-center justify-between gap-4 rounded-md bg-elevated px-4 py-3 transition-opacity duration-200"
            :class="isPreviewing ? 'opacity-50' : 'opacity-100'"
          >
            <div>
              <p class="text-sm">
                <span class="text-highlighted font-medium tabular-nums">{{ previewCount.toLocaleString() }}</span>
                <span class="text-muted">
                  {{ selectedLevel ? ` ${selectedLevel}` : '' }}
                  {{ previewCount === 1 ? ' log' : ' logs' }} older than
                  {{ activeValue }} {{ unitLabel }}{{ activeValue === 1 ? '' : 's' }}
                </span>
              </p>
              <p v-if="cutoffLabel" class="text-[11px] text-muted mt-0.5">
                Before {{ cutoffLabel }}
              </p>
            </div>
            <UButton
              v-if="previewCount > 0"
              label="Delete"
              color="error"
              size="xs"
              :loading="isDeleting"
              @click="deleteLogs"
            />
            <span v-else class="text-xs text-muted italic">Nothing to delete</span>
          </div>

          <div v-else-if="isPreviewing && previewCount === null" class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
            Counting logs…
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
