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
  source?: SourceData | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const isSubmitting = ref(false)

const isEditing = computed(() => !!props.source)

const form = ref({
  type: props.source?.type || 'github' as 'github' | 'youtube',
  label: props.source?.label || '',
  repo: props.source?.repo || '',
  branch: props.source?.branch || 'main',
  contentPath: props.source?.contentPath || '',
  outputPath: props.source?.outputPath || '',
  readmeOnly: props.source?.readmeOnly || false,
  channelId: props.source?.channelId || '',
  handle: props.source?.handle || '',
  maxVideos: props.source?.maxVideos || 50,
})

const typeOptions = [
  { label: 'GitHub', value: 'github', icon: 'i-simple-icons-github' },
  { label: 'YouTube', value: 'youtube', icon: 'i-simple-icons-youtube' },
]

async function save() {
  isSubmitting.value = true
  try {
    const url = isEditing.value ? `/api/sources/${props.source!.id}` : '/api/sources'
    const method = isEditing.value ? 'PUT' : 'POST'

    await $fetch(url, { method, body: form.value })
    toast.add({
      title: isEditing.value ? 'Source updated' : 'Source created',
      icon: 'i-lucide-check',
    })
    emit('saved')
  } catch (error: unknown) {
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to save source',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    :ui="{
      footer: 'justify-end',
      title: 'text-base font-medium',
      description: 'text-sm',
    }"
    :close="{ onClick: () => emit('close') }"
    default-open
    @update:open="(open: boolean) => !open && emit('close')"
  >
    <template #header>
      <div>
        <h2 class="text-base font-medium text-highlighted">{{ isEditing ? 'Edit Source' : 'Add Source' }}</h2>
        <p class="text-sm text-muted mt-0.5">{{ isEditing ? 'Update the source configuration' : 'Configure a new content source' }}</p>
      </div>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-highlighted">Type</label>
          <USelectMenu
            v-model="form.type"
            :items="typeOptions"
            value-key="value"
            :disabled="isEditing"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-highlighted">
            Label
            <span class="text-red-500">*</span>
          </label>
          <UInput v-model="form.label" placeholder="e.g. Nuxt Documentation" class="w-full" />
          <p class="text-xs text-muted">A friendly name to identify this source</p>
        </div>

        <template v-if="form.type === 'github'">
          <div class="border-t border-default pt-4 mt-1">
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-4">GitHub Configuration</p>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">
                  Repository
                  <span class="text-red-500">*</span>
                </label>
                <UInput
                  v-model="form.repo"
                  placeholder="nuxt/nuxt"
                  icon="i-simple-icons-github"
                  class="w-full"
                />
                <p class="text-xs text-muted">The repository in owner/repo format</p>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-highlighted">Branch</label>
                  <UInput
                    v-model="form.branch"
                    placeholder="main"
                    icon="i-lucide-git-branch"
                    class="w-full"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-highlighted">Output Path</label>
                  <UInput
                    v-model="form.outputPath"
                    placeholder="nuxt"
                    icon="i-lucide-folder-output"
                    class="w-full"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Content Path</label>
                <UInput
                  v-model="form.contentPath"
                  placeholder="docs/content"
                  icon="i-lucide-folder"
                  class="w-full"
                />
                <p class="text-xs text-muted">Path to the documentation folder</p>
              </div>

              <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-muted">
                <div>
                  <p class="text-sm font-medium text-highlighted">README Only</p>
                  <p class="text-xs text-muted">Only sync the README.md file</p>
                </div>
                <USwitch v-model="form.readmeOnly" />
              </div>
            </div>
          </div>
        </template>

        <template v-if="form.type === 'youtube'">
          <div class="border-t border-default pt-4 mt-1">
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-4">YouTube Configuration</p>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Channel ID</label>
                <UInput
                  v-model="form.channelId"
                  placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                  icon="i-simple-icons-youtube"
                  class="w-full"
                />
                <p class="text-xs text-muted">The unique channel identifier (starts with UC)</p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Handle</label>
                <UInput
                  v-model="form.handle"
                  placeholder="@channel"
                  icon="i-lucide-at-sign"
                  class="w-full"
                />
                <p class="text-xs text-muted">The channel's @handle for display</p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Max Videos</label>
                <UInput
                  v-model.number="form.maxVideos"
                  type="number"
                  :min="1"
                  :max="500"
                  icon="i-lucide-video"
                  class="w-full"
                />
                <p class="text-xs text-muted">Maximum number of videos to sync (default: 50)</p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        label="Cancel"
        @click="emit('close')"
      />
      <UButton
        :label="isEditing ? 'Save Changes' : 'Create Source'"
        size="sm"
        :loading="isSubmitting"
        @click="save"
      />
    </template>
  </UModal>
</template>
