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
  basePath: props.source?.type === 'youtube' ? '/youtube' : '/docs',
  readmeOnly: props.source?.readmeOnly || false,
  channelId: props.source?.channelId || '',
  handle: props.source?.handle || '',
  maxVideos: props.source?.maxVideos || 50,
})

const typeOptions = [
  { label: 'GitHub Repository', value: 'github', icon: 'i-simple-icons-github' },
  { label: 'YouTube Channel', value: 'youtube', icon: 'i-simple-icons-youtube' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const outputFolderFromLabel = computed(() => slugify(form.value.label))

const effectiveOutputPath = computed(() => {
  return form.value.outputPath || outputFolderFromLabel.value
})

const snapshotPreviewPath = computed(() => {
  const base = form.value.basePath || (form.value.type === 'youtube' ? '/youtube' : '/docs')
  const folder = effectiveOutputPath.value || 'folder-name'
  return `${base}/${folder}/`
})

watch(() => form.value.type, (newType) => {
  form.value.basePath = newType === 'youtube' ? '/youtube' : '/docs'
})

async function save() {
  isSubmitting.value = true
  try {
    const url = isEditing.value ? `/api/sources/${props.source!.id}` : '/api/sources'
    const method = isEditing.value ? 'PUT' : 'POST'

    const body = {
      ...form.value,
      outputPath: form.value.outputPath || outputFolderFromLabel.value,
    }

    await $fetch(url, { method, body })
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
      footer: 'justify-end gap-3',
      content: 'sm:max-w-2xl',
      body: 'p-0',
    }"
    :close="{ onClick: () => emit('close') }"
    default-open
    @update:open="(open: boolean) => !open && emit('close')"
  >
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          {{ isEditing ? 'Edit Source' : 'Add Source' }}
        </h2>
        <p class="text-sm text-muted mt-0.5">
          Configure a content source for documentation sync
        </p>
      </div>
    </template>

    <template #body>
      <div class="flex flex-col gap-5 p-5">
        <!-- Section 1: Basic Info -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-highlighted">Type</label>
            <USelectMenu
              v-model="form.type"
              :items="typeOptions"
              value-key="value"
              :disabled="isEditing"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-highlighted">
              Label <span class="text-error">*</span>
            </label>
            <UInput v-model="form.label" placeholder="e.g. Nuxt" />
          </div>
        </div>

        <!-- Section 2: Snapshot Location -->
        <div class="p-4 bg-muted/30 rounded-lg border border-default">
          <div class="flex items-start gap-3 mb-3">
            <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UIcon name="i-lucide-folder-output" class="size-4 text-primary" />
            </div>
            <div>
              <h3 class="text-sm font-medium text-highlighted">
                Snapshot Location
              </h3>
              <p class="text-xs text-muted mt-0.5">
                Where synced files will be stored
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-muted">Base Path</label>
              <UInput v-model="form.basePath" placeholder="/docs" class="font-mono text-sm" />
            </div>
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-xs text-muted">Folder Name</label>
              <UInput
                v-model="form.outputPath"
                :placeholder="outputFolderFromLabel || 'folder-name'"
                class="font-mono text-sm"
              />
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2 text-xs">
            <UIcon name="i-lucide-arrow-right" class="size-3 text-primary" />
            <span class="text-muted">Preview:</span>
            <code class="text-highlighted font-mono bg-default px-1.5 py-0.5 rounded">
              {{ snapshotPreviewPath }}
            </code>
          </div>
        </div>

        <!-- Section 3: Source-specific fields -->
        <div class="flex flex-col gap-4">
          <!-- GitHub Fields -->
          <template v-if="form.type === 'github'">
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">
                  Repository <span class="text-error">*</span>
                </label>
                <UInput
                  v-model="form.repo"
                  placeholder="nuxt/nuxt"
                  icon="i-simple-icons-github"
                />
                <p class="text-xs text-muted">
                  owner/repo format
                </p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Branch</label>
                <UInput
                  v-model="form.branch"
                  placeholder="main"
                  icon="i-lucide-git-branch"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Content Path</label>
                <UInput
                  v-model="form.contentPath"
                  placeholder="docs/content"
                  icon="i-lucide-folder-open"
                />
                <p class="text-xs text-muted">
                  Folder containing docs in repo
                </p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Options</label>
                <label class="flex items-center gap-3 h-9 px-3 rounded-lg border border-default bg-default cursor-pointer hover:bg-muted/30 transition-colors">
                  <USwitch v-model="form.readmeOnly" size="xs" />
                  <span class="text-sm">README only</span>
                </label>
              </div>
            </div>

            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-default">
              <UIcon name="i-lucide-info" class="size-3.5 text-muted shrink-0" />
              <p class="text-xs text-muted">
                Only <code class="text-highlighted">.md</code>, <code class="text-highlighted">.mdx</code>, <code class="text-highlighted">.yml</code>, <code class="text-highlighted">.yaml</code>, <code class="text-highlighted">.json</code> files are synced
              </p>
            </div>
          </template>

          <!-- YouTube Fields -->
          <template v-if="form.type === 'youtube'">
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">
                  Channel ID <span class="text-error">*</span>
                </label>
                <UInput
                  v-model="form.channelId"
                  placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                  icon="i-simple-icons-youtube"
                />
                <p class="text-xs text-muted">
                  Starts with UC
                </p>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Handle</label>
                <UInput
                  v-model="form.handle"
                  placeholder="@TheAlexLichter"
                  icon="i-lucide-at-sign"
                />
              </div>
            </div>

            <div class="w-1/2">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-highlighted">Max Videos</label>
                <UInput
                  v-model.number="form.maxVideos"
                  type="number"
                  :min="1"
                  :max="500"
                  icon="i-lucide-video"
                />
                <p class="text-xs text-muted">
                  Between 1 and 500
                </p>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="ghost" label="Cancel" @click="emit('close')" />
      <UButton
        :label="isEditing ? 'Save Changes' : 'Create Source'"
        :loading="isSubmitting"
        @click="save"
      />
    </template>
  </UModal>
</template>
