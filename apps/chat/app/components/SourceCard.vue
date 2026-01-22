<script setup lang="ts">
interface SourceData {
  id: string
  type: 'github' | 'youtube'
  label: string
  repo: string | null
  branch: string | null
  contentPath: string | null
  outputPath: string | null
  readmeOnly: boolean | null
  channelId: string | null
  handle: string | null
  maxVideos: number | null
}

const props = defineProps<{
  source: SourceData
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  sync: []
}>()

const isSyncing = ref(false)

function handleSync() {
  isSyncing.value = true
  emit('sync')
  setTimeout(() => {
    isSyncing.value = false
  }, 2000)
}

const hasBadges = computed(() => {
  if (props.source.type === 'github') {
    return props.source.branch || props.source.contentPath || props.source.outputPath || props.source.readmeOnly
  }
  return props.source.maxVideos
})
</script>

<template>
  <div class="group relative rounded-xl border border-default bg-default/50 hover:bg-elevated/50 transition-all duration-200 hover:shadow-sm">
    <div class="p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3 min-w-0">
          <div
            class="flex items-center justify-center size-9 rounded-lg shrink-0 transition-colors"
            :class="source.type === 'github'
              ? 'bg-neutral-100 dark:bg-neutral-800/80'
              : 'bg-red-50 dark:bg-red-950/50'"
          >
            <UIcon
              :name="source.type === 'github' ? 'i-simple-icons-github' : 'i-simple-icons-youtube'"
              class="size-4"
              :class="source.type === 'youtube' ? 'text-red-500' : 'text-neutral-700 dark:text-neutral-300'"
            />
          </div>

          <div class="min-w-0 pt-0.5">
            <h3 class="font-medium text-highlighted leading-tight">{{ source.label }}</h3>
            <p class="text-sm text-muted mt-0.5 truncate">
              <template v-if="source.type === 'github'">
                {{ source.repo }}
              </template>
              <template v-else>
                {{ source.handle || source.channelId }}
              </template>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <UTooltip text="Sync now" :delay-open="300">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-refresh-cw"
              :loading="isSyncing"
              class="rounded-lg"
              @click="handleSync"
            />
          </UTooltip>
          <UTooltip text="Edit" :delay-open="300">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              class="rounded-lg"
              @click="emit('edit')"
            />
          </UTooltip>
          <UTooltip text="Delete" :delay-open="300">
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              class="rounded-lg"
              @click="emit('delete')"
            />
          </UTooltip>
        </div>
      </div>

      <div v-if="hasBadges" class="flex flex-wrap items-center gap-1.5 mt-3 pl-12">
        <template v-if="source.type === 'github'">
          <span
            v-if="source.branch"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-800/80 text-muted"
          >
            <UIcon name="i-lucide-git-branch" class="size-3" />
            {{ source.branch }}
          </span>
          <span
            v-if="source.contentPath"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-800/80 text-muted"
          >
            <UIcon name="i-lucide-folder" class="size-3" />
            {{ source.contentPath }}
          </span>
          <span
            v-if="source.outputPath"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
          >
            <UIcon name="i-lucide-arrow-right" class="size-3" />
            {{ source.outputPath }}
          </span>
          <span
            v-if="source.readmeOnly"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
          >
            <UIcon name="i-lucide-file-text" class="size-3" />
            README only
          </span>
        </template>
        <template v-else>
          <span
            v-if="source.maxVideos"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-neutral-100 dark:bg-neutral-800/80 text-muted"
          >
            <UIcon name="i-lucide-video" class="size-3" />
            Max {{ source.maxVideos }} videos
          </span>
        </template>
      </div>
    </div>
  </div>
</template>
