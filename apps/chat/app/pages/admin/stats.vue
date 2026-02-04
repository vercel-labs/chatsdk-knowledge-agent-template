<script setup lang="ts">
const toast = useToast()

const periodOptions = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const selectedPeriod = ref(30)

const { data: stats, refresh, status } = await useFetch<GlobalStatsResponse>('/api/stats', {
  query: computed(() => ({ days: selectedPeriod.value })),
  watch: [selectedPeriod],
})

// Track if we're refreshing (vs initial load) to avoid flickering
const isRefreshing = computed(() => status.value === 'pending' && stats.value !== null)

const isComputing = ref(false)

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatModelName(modelId: string): string {
  const name = modelId.split('/')[1] || modelId
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Feedback score color
function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted'
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-error'
}

// Model satisfaction rate
function getModelSatisfaction(model: { positive: number, negative: number }): number | null {
  const total = model.positive + model.negative
  if (total === 0) return null
  return Math.round((model.positive / total) * 100)
}

const chartData = computed(() => {
  if (!stats.value?.daily) return []

  const byDate = new Map<string, { input: number, output: number }>()

  for (const day of stats.value.daily) {
    const existing = byDate.get(day.date) ?? { input: 0, output: 0 }
    existing.input += day.inputTokens
    existing.output += day.outputTokens
    byDate.set(day.date, existing)
  }

  return Array.from(byDate.entries())
    .map(([date, tokens]) => ({
      date: date.slice(5), // MM-DD format
      fullDate: date, // Keep full date for tooltip
      input: tokens.input,
      output: tokens.output,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
})

// Get evenly spaced date labels for the x-axis (5 labels max)
const chartDateLabels = computed(() => {
  if (chartData.value.length === 0) return []
  if (chartData.value.length <= 5) {
    return chartData.value.map((d, i) => ({ index: i, label: d.date }))
  }

  const count = chartData.value.length
  const step = (count - 1) / 4 // 5 labels: start, 3 middle, end

  return [0, 1, 2, 3, 4].map(i => {
    const index = Math.round(i * step)
    return { index, label: chartData.value[index]?.date ?? '' }
  })
})

async function triggerCompute() {
  try {
    isComputing.value = true
    await $fetch('/api/stats/compute', { method: 'POST' })
    toast.add({
      title: 'Stats computation started',
      description: 'The workflow has been triggered.',
      icon: 'i-lucide-check',
    })
    setTimeout(() => refresh(), 2000)
  } catch (error) {
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to compute stats',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isComputing.value = false
  }
}
</script>

<template>
  <div class="px-6 lg:px-10 py-8 max-w-4xl">
    <header class="mb-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-lg font-medium text-highlighted mb-1">
            Usage Statistics
          </h1>
          <p class="text-sm text-muted max-w-lg">
            Monitor AI usage, response quality, and model performance.
            <span v-if="stats?.period" class="block text-xs mt-0.5">
              {{ stats.period.from }} → {{ stats.period.to }}
            </span>
          </p>
        </div>
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-1">
            <UButton
              v-for="option in periodOptions"
              :key="option.value"
              size="xs"
              :color="selectedPeriod === option.value ? 'primary' : 'neutral'"
              :variant="selectedPeriod === option.value ? 'solid' : 'ghost'"
              :disabled="isRefreshing"
              @click="selectedPeriod = option.value"
            >
              {{ option.label }}
            </UButton>
          </div>
          <UDropdownMenu
            :items="[
              {
                label: 'Refresh data',
                icon: 'i-lucide-refresh-cw',
                onClick: () => refresh(),
              },
              {
                label: 'Recompute stats',
                icon: 'i-lucide-calculator',
                description: 'Run workflow (may take a few seconds)',
                onClick: triggerCompute,
              },
            ]"
          >
            <UButton
              icon="i-lucide-more-vertical"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="status === 'pending' || isComputing"
            />
          </UDropdownMenu>
        </div>
      </div>
    </header>

    <div v-if="status === 'pending' && !stats" class="flex items-center justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else-if="stats">
      <div
        class="transition-opacity duration-200"
        :class="isRefreshing ? 'opacity-50 pointer-events-none' : 'opacity-100'"
      >
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div class="rounded-lg border border-default bg-elevated/50 p-3">
            <p class="text-[11px] text-muted mb-0.5">
              Messages
            </p>
            <p class="text-xl font-semibold text-highlighted tabular-nums">
              {{ formatNumber(stats.totals.messages) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-3">
            <p class="text-[11px] text-muted mb-0.5">
              Total Tokens
            </p>
            <p class="text-xl font-semibold text-highlighted tabular-nums">
              {{ formatNumber(stats.totals.totalTokens) }}
            </p>
            <p class="text-[10px] text-muted">
              {{ formatNumber(stats.totals.inputTokens) }} in / {{ formatNumber(stats.totals.outputTokens) }} out
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-3">
            <p class="text-[11px] text-muted mb-0.5">
              Avg Response
            </p>
            <p class="text-xl font-semibold text-highlighted tabular-nums">
              {{ formatDuration(stats.totals.avgDurationMs) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-3">
            <p class="text-[11px] text-muted mb-0.5">
              Models
            </p>
            <p class="text-xl font-semibold text-highlighted tabular-nums">
              {{ stats.byModel.length }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-3">
            <p class="text-[11px] text-muted mb-0.5">
              Satisfaction
            </p>
            <p class="text-xl font-semibold tabular-nums" :class="getScoreColor(stats.feedback.score)">
              <template v-if="stats.feedback.score !== null">
                {{ stats.feedback.score }}%
              </template>
              <template v-else>
                <span class="text-muted">—</span>
              </template>
            </p>
            <p v-if="stats.feedback.total > 0" class="text-[10px] text-muted">
              {{ stats.feedback.positive }} <UIcon name="i-lucide-thumbs-up" class="size-2.5 inline" /> · {{ stats.feedback.negative }} <UIcon name="i-lucide-thumbs-down" class="size-2.5 inline" />
            </p>
          </div>
        </div>

        <section class="mb-8">
          <h2 class="text-sm font-medium text-highlighted mb-3">
            Token Usage
          </h2>
          <div v-if="chartData.length > 0" class="rounded-lg border border-default bg-elevated/50 p-4">
            <div class="h-40 flex items-end gap-0.5">
              <div
                v-for="(day, index) in chartData"
                :key="index"
                class="flex-1 flex flex-col justify-end group"
              >
                <UTooltip
                  :text="`${day.fullDate} — In: ${formatNumber(day.input)} / Out: ${formatNumber(day.output)}`"
                  :content="{ side: 'top', sideOffset: 6 }"
                >
                  <div class="w-full flex flex-col gap-px relative before:absolute before:inset-x-0 before:bottom-full before:h-40">
                    <div
                      class="w-full bg-primary rounded-t-sm transition-opacity group-hover:opacity-80"
                      :style="{ height: `${Math.max(2, (day.output / Math.max(...chartData.map(d => d.input + d.output))) * 100)}px` }"
                    />
                    <div
                      class="w-full bg-primary/40 rounded-b-sm transition-opacity group-hover:opacity-80"
                      :style="{ height: `${Math.max(2, (day.input / Math.max(...chartData.map(d => d.input + d.output))) * 100)}px` }"
                    />
                  </div>
                </UTooltip>
              </div>
            </div>
            <div class="relative h-4 mt-2">
              <span
                v-for="label in chartDateLabels"
                :key="label.index"
                class="absolute text-[10px] text-muted transform -translate-x-1/2"
                :style="{ left: `${(label.index / (chartData.length - 1)) * 100}%` }"
              >
                {{ label.label }}
              </span>
            </div>
            <div class="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-default text-[10px] text-muted">
              <span class="flex items-center gap-1">
                <span class="inline-block size-2 rounded bg-primary/40" />
                Input
              </span>
              <span class="flex items-center gap-1">
                <span class="inline-block size-2 rounded bg-primary" />
                Output
              </span>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
            <p class="text-sm text-muted">
              No usage data yet
            </p>
          </div>
        </section>

        <section v-if="stats.bySource && stats.bySource.length > 1" class="mb-8">
          <h2 class="text-sm font-medium text-highlighted mb-3">
            By Source
          </h2>
          <div class="rounded-lg border border-default overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-elevated/50">
                <tr class="border-b border-default text-xs text-muted">
                  <th class="text-left font-medium px-4 py-2.5">
                    Source
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Requests
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Tokens
                  </th>
                  <th class="text-right font-medium px-4 py-2.5">
                    Avg Time
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="source in stats.bySource" :key="source.source" class="hover:bg-elevated/30">
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <UIcon
                        :name="source.source === 'web' ? 'i-lucide-globe' : source.source === 'github-bot' ? 'i-simple-icons-github' : 'i-lucide-code'"
                        class="size-4 text-muted"
                      />
                      <span class="text-highlighted capitalize">{{ source.source.replace('-', ' ') }}</span>
                    </div>
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatNumber(source.requests) }}
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatNumber(source.totalTokens) }}
                  </td>
                  <td class="text-right text-muted tabular-nums px-4 py-2.5">
                    {{ formatDuration(source.avgDurationMs) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 class="text-sm font-medium text-highlighted mb-3">
            By Model
          </h2>
          <div v-if="stats.byModel.length > 0" class="rounded-lg border border-default overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-elevated/50">
                <tr class="border-b border-default text-xs text-muted">
                  <th class="text-left font-medium px-4 py-2.5">
                    Model
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Msgs
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Tokens
                  </th>
                  <th class="text-right font-medium px-4 py-2.5">
                    <UIcon name="i-lucide-thumbs-up" class="size-3.5" />
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="model in stats.byModel" :key="model.model" class="hover:bg-elevated/30">
                  <td class="px-4 py-2.5">
                    <span class="text-highlighted">{{ formatModelName(model.model) }}</span>
                    <span class="text-xs text-muted block truncate max-w-48">{{ model.model }}</span>
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatNumber(model.messageCount) }}
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatNumber(model.inputTokens + model.outputTokens) }}
                  </td>
                  <td class="text-right tabular-nums px-4 py-2.5" :class="getScoreColor(getModelSatisfaction(model))">
                    <template v-if="getModelSatisfaction(model) !== null">
                      {{ getModelSatisfaction(model) }}%
                    </template>
                    <template v-else>
                      <span class="text-muted">—</span>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
            <p class="text-sm text-muted">
              No model data yet
            </p>
          </div>
        </section>
      </div>
    </template>

    <div v-else class="flex flex-col items-center py-16 border border-dashed border-default rounded-lg">
      <div class="size-10 rounded-lg bg-elevated flex items-center justify-center mb-4">
        <UIcon name="i-lucide-bar-chart-3" class="size-5 text-muted" aria-hidden="true" />
      </div>
      <p class="text-sm font-medium text-highlighted mb-1">
        No statistics available
      </p>
      <p class="text-xs text-muted text-center max-w-xs">
        Start chatting to generate usage statistics
      </p>
    </div>
  </div>
</template>
