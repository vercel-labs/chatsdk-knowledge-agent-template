<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const { data: stats } = await useLazyFetch<UserStats>('/api/stats/me', {
  key: 'user-stats',
  getCachedData: (key, nuxtApp) =>
    nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
})

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
</script>

<template>
  <div v-if="stats && stats.totalMessages > 0">
    <UTooltip v-if="collapsed" :text="`${formatNumber(stats.totalMessages)} messages · ${formatNumber(stats.totalInputTokens + stats.totalOutputTokens)} tokens`">
      <div class="flex items-center justify-center p-1.5">
        <UIcon name="i-lucide-activity" class="size-4 text-muted" />
      </div>
    </UTooltip>

    <div v-else class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-muted font-mono">
      <UIcon name="i-lucide-activity" class="size-3 shrink-0" />
      <span class="tabular-nums"><span class="text-highlighted">{{ formatNumber(stats.totalMessages) }}</span> msg</span>
      <span class="opacity-40">·</span>
      <span class="tabular-nums"><span class="text-highlighted">{{ formatNumber(stats.totalInputTokens + stats.totalOutputTokens) }}</span> tok</span>
    </div>
  </div>
</template>
