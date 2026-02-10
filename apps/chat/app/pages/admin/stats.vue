<script setup lang="ts">

const periodOptions = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const selectedPeriod = ref(30)
const selectedSources = ref<string[]>([])
const selectedModels = ref<string[]>([])
const chartMetric = ref<'tokens' | 'messages'>('tokens')

const cachedStats = useState<GlobalStatsResponse | null>('admin-stats', () => null)

const { data: stats, refresh, status } = useLazyFetch<GlobalStatsResponse>('/api/stats', {
  query: computed(() => ({
    days: selectedPeriod.value,
    sources: selectedSources.value.length > 0 ? selectedSources.value.join(',') : undefined,
    models: selectedModels.value.length > 0 ? selectedModels.value.join(',') : undefined,
  })),
  watch: [selectedPeriod, selectedSources, selectedModels],
})

if (!stats.value && cachedStats.value) {
  stats.value = cachedStats.value
}
watch(stats, (v) => {
  if (v) cachedStats.value = v 
})

const isRefreshing = computed(() => status.value === 'pending' && stats.value !== null)

const hasFilters = computed(() => selectedSources.value.length > 0 || selectedModels.value.length > 0)

function clearFilters() {
  selectedSources.value = []
  selectedModels.value = []
}

const sourceOptions = computed(() =>
  (stats.value?.availableSources ?? []).map(s => ({ label: s.replace('-', ' '), value: s })),
)

const modelOptions = computed(() =>
  (stats.value?.availableModels ?? []).map(m => ({ label: formatModelName(m), value: m })),
)

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
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

function formatCost(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`
  if (amount >= 0.01) return `$${amount.toFixed(3)}`
  if (amount === 0) return '$0.00'
  return `$${amount.toFixed(4)}`
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted'
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-error'
}

function getModelSatisfaction(model: { positive: number, negative: number }): number | null {
  const total = model.positive + model.negative
  if (total === 0) return null
  return Math.round((model.positive / total) * 100)
}

function formatTrend(trend: number | null): string {
  if (trend === null) return '—'
  const sign = trend >= 0 ? '+' : ''
  return `${sign}${trend}%`
}

function getTrendColor(trend: number | null): string {
  if (trend === null) return 'text-muted'
  if (trend > 0) return 'text-success'
  if (trend < 0) return 'text-error'
  return 'text-muted'
}

function getTrendIcon(trend: number | null): string {
  if (trend === null) return 'i-lucide-minus'
  if (trend > 0) return 'i-lucide-trending-up'
  if (trend < 0) return 'i-lucide-trending-down'
  return 'i-lucide-minus'
}

const sourceColorMap: Record<string, string> = {
  'web': 'bg-primary',
  'github-bot': 'bg-emerald-500',
  'discord-bot': 'bg-violet-500',
  'sdk': 'bg-amber-500',
}

function getSourceColor(source: string): string {
  return sourceColorMap[source] ?? 'bg-gray-400'
}

const chartDataBySource = computed(() => {
  if (!stats.value?.dailyBySource) return []

  const byDate = new Map<string, Map<string, { tokens: number, messages: number }>>()

  for (const entry of stats.value.dailyBySource) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, new Map())
    const sourceMap = byDate.get(entry.date)!
    const existing = sourceMap.get(entry.source) ?? { tokens: 0, messages: 0 }
    existing.tokens += entry.inputTokens + entry.outputTokens
    existing.messages += entry.messageCount
    sourceMap.set(entry.source, existing)
  }

  return Array.from(byDate.entries())
    .map(([date, sourceMap]) => ({
      date: date.slice(5),
      fullDate: date,
      sources: Object.fromEntries(sourceMap),
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
})

const chartSources = computed(() => {
  const sources = new Set<string>()
  for (const day of chartDataBySource.value) {
    for (const src of Object.keys(day.sources)) sources.add(src)
  }
  return Array.from(sources).sort()
})

const chartMax = computed(() => {
  let max = 0
  for (const day of chartDataBySource.value) {
    let total = 0
    for (const s of Object.values(day.sources)) {
      total += chartMetric.value === 'tokens' ? s.tokens : s.messages
    }
    if (total > max) max = total
  }
  return max || 1
})

const chartDateLabels = computed(() => {
  if (chartDataBySource.value.length === 0) return []
  if (chartDataBySource.value.length <= 5) {
    return chartDataBySource.value.map((d, i) => ({ index: i, label: d.date }))
  }

  const count = chartDataBySource.value.length
  const step = (count - 1) / 4

  return [0, 1, 2, 3, 4].map(i => {
    const index = Math.round(i * step)
    return { index, label: chartDataBySource.value[index]?.date ?? '' }
  })
})

const peakHoursData = computed(() => stats.value?.hourlyDistribution ?? [])
const peakHoursMax = computed(() => {
  let max = 0
  for (const h of peakHoursData.value) {
    if (h.messageCount > max) max = h.messageCount
  }
  return max || 1
})

function getModelCost(modelId: string): number | null {
  const entry = stats.value?.estimatedCost?.byModel?.find(m => m.model === modelId)
  return entry ? entry.totalCost : null
}

</script>

<template>
  <div class="px-6 py-8 max-w-5xl mx-auto w-full">
    <header class="mb-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
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
          <UTooltip text="Refresh data">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="isRefreshing"
              @click="refresh()"
            />
          </UTooltip>
        </div>
      </div>
    </header>

    <div v-if="status === 'pending' && !stats">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div v-for="i in 6" :key="i" class="rounded-lg border border-default bg-elevated/50 p-4">
          <USkeleton class="h-3 w-16 mb-2" />
          <USkeleton class="h-7 w-12 mb-1" />
          <USkeleton class="h-3 w-10" />
        </div>
      </div>
      <USkeleton class="h-48 w-full rounded-lg mb-8" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <USkeleton class="h-56 w-full rounded-lg" />
        <USkeleton class="h-56 w-full rounded-lg" />
      </div>
    </div>

    <template v-else-if="stats">
      <div
        class="transition-opacity duration-200"
        :class="isRefreshing ? 'opacity-50 pointer-events-none' : 'opacity-100'"
      >
        <div v-if="sourceOptions.length > 0 || modelOptions.length > 0" class="flex items-center gap-3 mb-6 flex-wrap">
          <USelectMenu
            v-if="sourceOptions.length > 0"
            v-model="selectedSources"
            :items="sourceOptions"
            multiple
            placeholder="All sources"
            class="w-44"
            size="xs"
            value-key="value"
          />
          <USelectMenu
            v-if="modelOptions.length > 0"
            v-model="selectedModels"
            :items="modelOptions"
            multiple
            placeholder="All models"
            class="w-52"
            size="xs"
            value-key="value"
          />
          <UButton
            v-if="hasFilters"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="clearFilters"
          >
            Clear
          </UButton>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="text-xs text-muted mb-1">
              Messages
            </p>
            <p class="text-2xl font-semibold text-highlighted tabular-nums">
              {{ formatNumber(stats.totals.messages) }}
            </p>
            <p v-if="stats.trends?.messages !== undefined" class="text-[11px] flex items-center gap-1 mt-1" :class="getTrendColor(stats.trends.messages)">
              <UIcon :name="getTrendIcon(stats.trends.messages)" class="size-3.5" />
              {{ formatTrend(stats.trends.messages) }} vs prev
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="text-xs text-muted mb-1">
              Total Tokens
            </p>
            <p class="text-2xl font-semibold text-highlighted tabular-nums">
              {{ formatCompactNumber(stats.totals.totalTokens) }}
            </p>
            <p v-if="stats.trends?.tokens !== undefined" class="text-[11px] flex items-center gap-1 mt-1" :class="getTrendColor(stats.trends.tokens)">
              <UIcon :name="getTrendIcon(stats.trends.tokens)" class="size-3.5" />
              {{ formatTrend(stats.trends.tokens) }} vs prev
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="text-xs text-muted mb-1">
              Active Users
            </p>
            <p class="text-2xl font-semibold text-highlighted tabular-nums">
              {{ stats.totals.activeUsers ?? 0 }}
            </p>
            <p v-if="stats.trends?.activeUsers !== undefined" class="text-[11px] flex items-center gap-1 mt-1" :class="getTrendColor(stats.trends.activeUsers)">
              <UIcon :name="getTrendIcon(stats.trends.activeUsers)" class="size-3.5" />
              {{ formatTrend(stats.trends.activeUsers) }} vs prev
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="text-xs text-muted mb-1">
              Avg Response
            </p>
            <p class="text-2xl font-semibold text-highlighted tabular-nums">
              {{ formatDuration(stats.totals.avgDurationMs) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="text-xs text-muted mb-1">
              Est. Cost
            </p>
            <p class="text-2xl font-semibold text-highlighted tabular-nums">
              {{ formatCost(stats.estimatedCost?.total ?? 0) }}
            </p>
            <p class="text-[11px] text-muted mt-1">
              {{ stats.byModel.length }} model{{ stats.byModel.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="text-xs text-muted mb-1">
              Satisfaction
            </p>
            <p class="text-2xl font-semibold tabular-nums" :class="getScoreColor(stats.feedback.score)">
              <template v-if="stats.feedback.score !== null">
                {{ stats.feedback.score }}%
              </template>
              <template v-else>
                <span class="text-muted">—</span>
              </template>
            </p>
            <p v-if="stats.feedback.total > 0" class="text-[11px] text-muted mt-1">
              {{ stats.feedback.positive }} <UIcon name="i-lucide-thumbs-up" class="size-3 inline" /> · {{ stats.feedback.negative }} <UIcon name="i-lucide-thumbs-down" class="size-3 inline" />
            </p>
          </div>
        </div>

        <section class="mb-10">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-medium text-highlighted">
              Usage Over Time
            </h2>
            <div class="flex items-center gap-1">
              <UButton
                size="xs"
                :color="chartMetric === 'tokens' ? 'primary' : 'neutral'"
                :variant="chartMetric === 'tokens' ? 'solid' : 'ghost'"
                @click="chartMetric = 'tokens'"
              >
                Tokens
              </UButton>
              <UButton
                size="xs"
                :color="chartMetric === 'messages' ? 'primary' : 'neutral'"
                :variant="chartMetric === 'messages' ? 'solid' : 'ghost'"
                @click="chartMetric = 'messages'"
              >
                Messages
              </UButton>
            </div>
          </div>
          <div v-if="chartDataBySource.length > 0" class="rounded-lg border border-default bg-elevated/50 p-4 overflow-hidden">
            <div class="h-40 flex items-end gap-0.5 px-4">
              <div
                v-for="(day, index) in chartDataBySource"
                :key="index"
                class="flex-1 flex flex-col justify-end group"
              >
                <UTooltip
                  :text="`${day.fullDate} — ${chartMetric === 'tokens' ? formatCompactNumber(Object.values(day.sources).reduce((s, v) => s + v.tokens, 0)) + ' tokens' : Object.values(day.sources).reduce((s, v) => s + v.messages, 0) + ' msgs'}`"
                  :content="{ side: 'top', sideOffset: 6 }"
                >
                  <div class="w-full flex flex-col-reverse relative before:absolute before:inset-x-0 before:bottom-full before:h-40">
                    <template v-for="src in chartSources" :key="src">
                      <div
                        v-if="day.sources[src]"
                        class="w-full transition-opacity group-hover:opacity-80 first:rounded-b-sm last:rounded-t-sm"
                        :class="getSourceColor(src)"
                        :style="{ height: `${Math.max(1, ((chartMetric === 'tokens' ? day.sources[src].tokens : day.sources[src].messages) / chartMax) * 140)}px` }"
                      />
                    </template>
                  </div>
                </UTooltip>
              </div>
            </div>
            <div class="relative h-4 mt-2 mx-4">
              <span
                v-for="label in chartDateLabels"
                :key="label.index"
                class="absolute text-[10px] text-muted transform -translate-x-1/2"
                :style="{ left: `${(label.index / Math.max(chartDataBySource.length - 1, 1)) * 100}%` }"
              >
                {{ label.label }}
              </span>
            </div>
            <div class="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-default text-[10px] text-muted">
              <span v-for="src in chartSources" :key="src" class="flex items-center gap-1">
                <span class="inline-block size-2 rounded" :class="getSourceColor(src)" />
                {{ src.replace('-', ' ') }}
              </span>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
            <p class="text-sm text-muted">
              No usage data yet
            </p>
          </div>
        </section>

        <section v-if="peakHoursData.some(h => h.messageCount > 0)" class="mb-10">
          <h2 class="text-xs text-highlighted mb-3 font-pixel tracking-wide uppercase">
            Peak Hours (UTC)
          </h2>
          <div class="rounded-lg border border-default bg-elevated/50 p-4 overflow-hidden">
            <div class="h-24 flex items-end gap-px px-2">
              <div
                v-for="h in peakHoursData"
                :key="h.hour"
                class="flex-1 group"
              >
                <UTooltip
                  :text="`${String(h.hour).padStart(2, '0')}:00 — ${h.messageCount} msgs, ${formatCompactNumber(h.totalTokens)} tokens`"
                  :content="{ side: 'top', sideOffset: 4 }"
                >
                  <div
                    class="w-full bg-primary/60 rounded-t-sm transition-opacity group-hover:bg-primary relative before:absolute before:inset-x-0 before:bottom-full before:h-24"
                    :style="{ height: `${Math.max(2, (h.messageCount / peakHoursMax) * 80)}px` }"
                  />
                </UTooltip>
              </div>
            </div>
            <div class="flex justify-between px-2 mt-1.5">
              <span v-for="label in ['00', '06', '12', '18', '23']" :key="label" class="text-[10px] text-muted">
                {{ label }}
              </span>
            </div>
          </div>
        </section>

        <div class="grid md:grid-cols-2 gap-8 mb-8 items-start">
          <section>
            <h2 class="text-xs text-highlighted mb-3 font-pixel tracking-wide uppercase">
              Top Users
            </h2>
            <div v-if="stats.topUsers && stats.topUsers.length > 0" class="rounded-lg border border-default overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-elevated/50">
                  <tr class="border-b border-default text-xs text-muted">
                    <th class="text-left font-medium px-4 py-2.5">
                      User
                    </th>
                    <th class="text-right font-medium px-3 py-2.5">
                      Msgs
                    </th>
                    <th class="text-right font-medium px-4 py-2.5">
                      Tokens
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-for="user in stats.topUsers.slice(0, 5)" :key="user.userId" class="hover:bg-elevated/30">
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="user.avatar"
                          :src="user.avatar"
                          :alt="user.name"
                          class="size-6 rounded-full"
                        >
                        <div v-else class="size-6 rounded-full bg-muted/20 flex items-center justify-center">
                          <UIcon name="i-lucide-user" class="size-3 text-muted" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-highlighted truncate text-xs">
                            {{ user.name }}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="text-right text-muted tabular-nums px-3 py-2.5 text-xs">
                      {{ formatNumber(user.messageCount) }}
                    </td>
                    <td class="text-right text-muted tabular-nums px-4 py-2.5 text-xs">
                      {{ formatCompactNumber(user.totalTokens) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
              <p class="text-sm text-muted">
                No user data yet
              </p>
            </div>
          </section>

          <section v-if="stats.bySource && stats.bySource.length > 0">
            <h2 class="text-xs text-highlighted mb-3 font-pixel tracking-wide uppercase">
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
                    <th class="text-right font-medium px-4 py-2.5">
                      Tokens
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-for="source in stats.bySource" :key="source.source" class="hover:bg-elevated/30">
                    <td class="px-4 py-2.5">
                      <div class="flex items-center gap-2">
                        <UIcon
                          :name="source.source === 'web' ? 'i-lucide-globe' : source.source === 'github-bot' ? 'i-simple-icons-github' : source.source === 'discord-bot' ? 'i-simple-icons-discord' : 'i-lucide-code'"
                          class="size-4 text-muted"
                        />
                        <span class="text-highlighted capitalize text-xs">{{ source.source.replace('-', ' ') }}</span>
                      </div>
                    </td>
                    <td class="text-right text-muted tabular-nums px-3 py-2.5 text-xs">
                      {{ formatNumber(source.requests) }}
                    </td>
                    <td class="text-right text-muted tabular-nums px-4 py-2.5 text-xs">
                      {{ formatCompactNumber(source.totalTokens) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section>
          <h2 class="text-xs text-highlighted mb-3 font-pixel tracking-wide uppercase">
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
                    Messages
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Tokens
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Cost
                  </th>
                  <th class="text-right font-medium px-3 py-2.5">
                    Avg Response
                  </th>
                  <th class="text-right font-medium px-4 py-2.5">
                    Satisfaction
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="model in stats.byModel" :key="model.model" class="hover:bg-elevated/30">
                  <td class="px-4 py-2.5">
                    <span class="text-highlighted">{{ formatModelName(model.model) }}</span>
                    <span class="text-xs text-muted block truncate max-w-64">{{ model.model }}</span>
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatNumber(model.messageCount) }}
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatCompactNumber(model.inputTokens + model.outputTokens) }}
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ getModelCost(model.model) !== null ? formatCost(getModelCost(model.model)!) : '—' }}
                  </td>
                  <td class="text-right text-muted tabular-nums px-3 py-2.5">
                    {{ formatDuration(model.avgDurationMs) }}
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
