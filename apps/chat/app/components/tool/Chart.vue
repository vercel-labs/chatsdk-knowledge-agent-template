<script setup lang="ts">
defineProps<{
  invocation: ChartUIToolInvocation
}>()

const xFormatter = (invocation: ChartUIToolInvocation) => {
  return (tick: number, _i?: number, _ticks?: number[]): string => {
    if (!invocation.output?.data[tick]) return ''
    return String(invocation.output.data[tick][invocation.output.xKey] ?? '')
  }
}

const categories = (invocation: ChartUIToolInvocation): Record<string, BulletLegendItemInterface> => {
  if (!invocation.output?.series) return {}
  return invocation.output.series.reduce((acc, serie) => {
    acc[serie.key] = {
      name: serie.name,
      color: serie.color
    }
    return acc
  }, {} as Record<string, BulletLegendItemInterface>)
}

const formatValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return 'N/A'
  if (typeof value === 'string') return value

  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}
</script>

<template>
  <div class="w-full md:min-w-[600px] max-w-3xl h-[380px]">
    <template v-if="invocation.state === 'output-available'">
      <div v-if="invocation.output.title" class="flex items-center gap-3 mb-4">
        <UIcon name="i-lucide-line-chart" class="size-5 text-primary shrink-0" />
        <div class="min-w-0">
          <h3 class="text-lg font-semibold truncate">
            {{ invocation.output.title }}
          </h3>
        </div>
      </div>

      <div class="relative rounded-xl overflow-hidden">
        <div class="dot-pattern h-full -top-5 left-0 right-0" />

        <LineChart
          :height="300"
          :data="invocation.output.data"
          :categories="categories(invocation)"
          :x-formatter="xFormatter(invocation)"
          :x-label="invocation.output.xLabel"
          :y-label="invocation.output.yLabel"
          :y-grid-line="true"
          :curve-type="CurveType.MonotoneX"
          :legend-position="LegendPosition.TopRight"
          :hide-legend="false"
          :x-num-ticks="Math.min(6, invocation.output.data.length)"
          :y-num-ticks="5"
          :show-tooltip="true"
        >
          <template #tooltip="{ values }">
            <div class="bg-muted/50 rounded-sm px-2 py-1 shadow-lg backdrop-blur-sm max-w-xs ring ring-offset-2 ring-offset-bg ring-default border border-default">
              <div v-if="values && values[invocation.output.xKey]" class="text-sm font-semibold text-highlighted mb-2">
                {{ values[invocation.output.xKey] }}
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="serie in invocation.output.series"
                  :key="serie.key"
                  class="flex items-center justify-between gap-3"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <div
                      class="size-2.5 rounded-full shrink-0"
                      :style="{ backgroundColor: serie.color }"
                    />
                    <span class="text-sm text-muted truncate">{{ serie.name }}</span>
                  </div>
                  <span class="text-sm font-semibold text-highlighted shrink-0">
                    {{ formatValue(values?.[serie.key]) }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </LineChart>
      </div>
    </template>

    <div v-else-if="invocation.state === 'output-error'" class="h-full flex items-center justify-center bg-muted border border-default rounded-xl px-5 py-4 shadow">
      <div class="text-center">
        <UIcon
          name="i-lucide-alert-triangle"
          class="size-8 text-error mx-auto mb-2"
        />
        <div class="text-sm text-muted">
          Can't generate chart, please try again
        </div>
      </div>
    </div>

    <div v-else class="h-full border border-default rounded-xl p-4 shadow flex flex-col gap-2">
      <USkeleton class="w-1/3 h-4" />
      <div class="flex justify-end gap-2">
        <USkeleton class="w-[20%] h-3" />
      </div>
      <div class="relative flex flex-1 gap-2">
        <USkeleton class="w-[3%] h-full" />
        <USkeleton class="flex-1 h-full" />
        <span class="absolute inset-0 flex items-center justify-center text-xs text-muted italic gap-1">
          <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
          Generating chart...
        </span>
      </div>
      <USkeleton class="w-full h-4" />
    </div>
  </div>
</template>

<style>
:root {
  --vis-tooltip-padding: 0 !important;
  --vis-tooltip-background-color: transparent !important;
  --vis-tooltip-border-color: transparent !important;

  --vis-axis-grid-color: rgba(255, 255, 255, 0) !important;
  --vis-axis-tick-label-color: var(--ui-text-muted) !important;
  --vis-axis-label-color: var(--ui-text-toned) !important;
  --vis-legend-label-color: var(--ui-text-muted) !important;

  --dot-pattern-color: #111827;
}

.dark {
  --dot-pattern-color: #9ca3af;
}

.dot-pattern {
  position: absolute;
  background-image: radial-gradient(var(--dot-pattern-color) 1px, transparent 1px);
  background-size: 7px 7px;
  background-position: -8.5px -8.5px;
  opacity: 20%;
  mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 1), transparent 75%);
}
</style>
