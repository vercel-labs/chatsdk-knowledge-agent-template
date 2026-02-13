<script setup lang="ts">
import type { SourceOcrItem } from '#shared/utils/source-ocr'

useSeoMeta({ title: 'New Source - Admin' })

interface PendingFile {
  id: string
  file: File
  previewUrl?: string
  type: 'image' | 'config'
}

interface ExtractedSource {
  id: string
  data: {
    type: 'github' | 'youtube'
    label: string
    repo: string
    branch: string
    contentPath: string
    outputPath: string
    basePath: string
    readmeOnly: boolean
    channelId: string
    handle: string
    maxVideos: number
  }
  confidence: number
}

const CONFIG_EXTENSIONS = ['.ts', '.js', '.json', '.yml', '.yaml', '.toml']
const CONFIG_ACCEPT = CONFIG_EXTENSIONS.join(',')

const router = useRouter()
const route = useRoute()
const toast = useToast()

const { data: sourcesData } = useLazyFetch('/api/sources')
const youtubeEnabled = computed(() => sourcesData.value?.youtubeEnabled ?? false)

const requestedType = route.query.type === 'youtube' ? 'youtube' : 'github'
const initialType = (requestedType === 'youtube' && !youtubeEnabled.value ? 'github' : requestedType) as 'github' | 'youtube'

const isSubmitting = ref(false)
const isExtracting = ref(false)
const isDragging = ref(false)
const showQuickImport = ref(false)
const pendingFiles = shallowRef<PendingFile[]>([])
const sources = ref<ExtractedSource[]>([
  {
    id: crypto.randomUUID(),
    data: {
      type: initialType,
      label: '',
      repo: '',
      branch: 'main',
      contentPath: '',
      outputPath: '',
      basePath: initialType === 'youtube' ? '/youtube' : '/docs',
      readmeOnly: false,
      channelId: '',
      handle: '',
      maxVideos: 50,
    },
    confidence: 1,
  }
])
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(pendingFiles, (files) => {
  if (files.length > 0 && !showQuickImport.value) {
    showQuickImport.value = true
  }
})

function createSourceData(item?: SourceOcrItem) {
  return {
    type: (item?.type || 'github') as 'github' | 'youtube',
    label: item?.label || '',
    repo: item?.repo || '',
    branch: item?.branch || 'main',
    contentPath: item?.contentPath || '',
    outputPath: '',
    basePath: item?.type === 'youtube' ? '/youtube' : '/docs',
    readmeOnly: false,
    channelId: item?.channelId || '',
    handle: item?.handle || '',
    maxVideos: 50,
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\./g, '-')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isConfigFile(file: File): boolean {
  return CONFIG_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

function handleFiles(files: File[]) {
  const newItems: PendingFile[] = []
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        type: 'image',
      })
    } else if (isConfigFile(file)) {
      newItems.push({
        id: crypto.randomUUID(),
        file,
        type: 'config',
      })
    }
  }
  if (newItems.length > 0) {
    pendingFiles.value = [...pendingFiles.value, ...newItems]
  }
}

function removeFile(id: string) {
  const item = pendingFiles.value.find(f => f.id === id)
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl)
  }
  pendingFiles.value = pendingFiles.value.filter(f => f.id !== id)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

async function extractAll() {
  if (pendingFiles.value.length === 0) return

  isExtracting.value = true

  try {
    const images: string[] = []
    const configs: { filename: string, content: string }[] = []

    for (const item of pendingFiles.value) {
      if (item.type === 'image') {
        images.push(await fileToBase64(item.file))
      } else {
        configs.push({
          filename: item.file.name,
          content: await fileToText(item.file),
        })
      }
    }

    const result = await $fetch('/api/sources/ocr', {
      method: 'POST',
      body: { images, configs },
    }) as { sources: SourceOcrItem[] }

    for (const item of result.sources) {
      sources.value.push({
        id: crypto.randomUUID(),
        data: createSourceData(item),
        confidence: item.confidence,
      })
    }

    pendingFiles.value.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
    pendingFiles.value = []

    if (result.sources.length > 0) {
      toast.add({
        title: `${result.sources.length} source${result.sources.length > 1 ? 's' : ''} extracted`,
        icon: 'i-lucide-sparkles',
      })
    } else {
      toast.add({
        title: 'No sources found',
        description: 'Could not detect any source configuration',
        color: 'warning',
        icon: 'i-lucide-alert-circle',
      })
    }
  } catch (error) {
    toast.add({
      title: 'Extraction failed',
      description: error instanceof Error ? error.message : 'Failed to extract sources',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isExtracting.value = false
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  handleFiles(files)
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) {
    isDragging.value = false
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    handleFiles(Array.from(input.files))
    input.value = ''
  }
}

function removeSource(id: string) {
  if (sources.value.length > 1) {
    sources.value = sources.value.filter(s => s.id !== id)
  }
}

function addManualSource() {
  sources.value.push({
    id: crypto.randomUUID(),
    data: createSourceData(),
    confidence: 1,
  })
}

function getEffectiveOutputPath(source: ExtractedSource) {
  return source.data.outputPath || slugify(source.data.label)
}

function getSnapshotPreview(source: ExtractedSource) {
  const base = source.data.basePath || (source.data.type === 'youtube' ? '/youtube' : '/docs')
  const folder = getEffectiveOutputPath(source) || 'folder-name'
  return `${base}/${folder}/`
}

function getFileIcon(file: PendingFile) {
  if (file.type === 'image') return 'i-lucide-image'
  const ext = file.file.name.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'i-lucide-braces'
  if (ext === 'ts' || ext === 'js') return 'i-lucide-file-code'
  if (ext === 'yml' || ext === 'yaml') return 'i-lucide-file-text'
  return 'i-lucide-file'
}

async function saveAll() {
  const validSources = sources.value.filter(s => s.data.label)

  if (validSources.length === 0) {
    toast.add({
      title: 'No sources to create',
      description: 'Add at least one source with a label',
      color: 'warning',
      icon: 'i-lucide-alert-circle',
    })
    return
  }

  isSubmitting.value = true
  let created = 0

  for (const source of validSources) {
    try {
      await $fetch('/api/sources', {
        method: 'POST',
        body: {
          ...source.data,
          outputPath: getEffectiveOutputPath(source),
        },
      })
      created++
    } catch (error) {
      toast.add({
        title: 'Failed to create source',
        description: error instanceof Error ? error.message : 'Unknown error',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  }

  isSubmitting.value = false

  if (created > 0) {
    toast.add({
      title: `${created} source${created > 1 ? 's' : ''} created`,
      icon: 'i-lucide-check',
    })
    router.push('/admin')
  } else {
    toast.add({
      title: 'Failed to create sources',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const typeOptions = computed(() => {
  const options = [{ label: 'GitHub', value: 'github', icon: 'i-simple-icons-github' },]

  if (youtubeEnabled.value) {
    options.push({ label: 'YouTube', value: 'youtube', icon: 'i-simple-icons-youtube' })
  }

  return options
})

const hasValidSources = computed(() => sources.value.some(s => s.data.label))
const validSourcesCount = computed(() => sources.value.filter(s => s.data.label).length)
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Add Sources
      </h1>
      <p class="text-sm text-muted">
        Sources provide context to the AI. Connect your GitHub docs{{ youtubeEnabled ? ' or YouTube channels' : '' }}.
      </p>
    </header>

    <section v-if="showQuickImport" class="mb-8">
      <p class="text-[10px] text-muted mb-3 font-pixel tracking-wide uppercase">
        Quick import
      </p>

      <div
        class="relative p-8 border border-dashed rounded-lg transition-colors cursor-pointer"
        :class="[
          isDragging ? 'border-primary bg-primary/5' : 'border-default hover:border-muted hover:bg-elevated/30',
        ]"
        @drop="handleDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @click="fileInputRef?.click()"
      >
        <input
          ref="fileInputRef"
          type="file"
          :accept="`image/*,${CONFIG_ACCEPT}`"
          multiple
          class="hidden"
          @change="handleFileSelect"
        >

        <div class="text-center">
          <div class="size-10 rounded-lg bg-elevated flex items-center justify-center mx-auto mb-3">
            <UIcon
              :name="isDragging ? 'i-lucide-download' : 'i-lucide-upload'"
              class="size-5 text-muted"
              :class="{ 'text-primary': isDragging }"
              aria-hidden="true"
            />
          </div>
          <p class="text-sm text-highlighted mb-1">
            Drop files here or click to browse…
          </p>
          <p class="text-xs text-muted">
            Screenshots of configs, or .ts, .json, .yml files
          </p>
        </div>
      </div>
    </section>

    <section v-if="pendingFiles.length > 0" class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] text-muted font-pixel tracking-wide uppercase">
          Files to extract
        </p>
        <UButton
          icon="i-lucide-sparkles"
          size="xs"
          :loading="isExtracting"
          @click="extractAll"
        >
          Extract
        </UButton>
      </div>

      <div class="flex flex-wrap gap-2">
        <div
          v-for="item in pendingFiles"
          :key="item.id"
          class="relative group"
        >
          <div
            v-if="item.type === 'image'"
            class="w-20 h-14 rounded-md border border-default overflow-hidden"
          >
            <img
              :src="item.previewUrl"
              :alt="item.file.name"
              class="w-full h-full object-cover"
            >
          </div>
          <div
            v-else
            class="w-20 h-14 rounded-md border border-default bg-elevated flex flex-col items-center justify-center gap-0.5"
          >
            <UIcon :name="getFileIcon(item)" class="size-4 text-muted" aria-hidden="true" />
            <span class="text-[10px] text-muted truncate max-w-16 px-1">{{ item.file.name }}</span>
          </div>
          <button
            class="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove file"
            @click.stop="removeFile(item.id)"
          >
            <UIcon name="i-lucide-x" class="size-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>

    <section class="mb-2">
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] text-muted font-pixel tracking-wide uppercase">
          Your sources
        </p>
        <button
          class="text-xs text-muted hover:text-highlighted transition-colors flex items-center gap-1"
          @click="addManualSource"
        >
          <UIcon name="i-lucide-plus" class="size-3" aria-hidden="true" />
          Add source
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="source in sources"
          :key="source.id"
          class="p-4 rounded-lg border border-default"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex-1 grid grid-cols-3 gap-2">
              <USelectMenu
                v-model="source.data.type"
                :items="typeOptions"
                value-key="value"
                size="sm"
                @update:model-value="source.data.basePath = $event === 'youtube' ? '/youtube' : '/docs'"
              />
              <div class="col-span-2">
                <UInput
                  v-model="source.data.label"
                  placeholder="Label (e.g. Nuxt)"
                  size="sm"
                  autocomplete="off"
                />
              </div>
            </div>
            <button
              class="text-muted hover:text-error transition-colors p-1"
              aria-label="Delete source"
              @click="removeSource(source.id)"
            >
              <UIcon name="i-lucide-trash-2" class="size-4" aria-hidden="true" />
            </button>
          </div>

          <div class="space-y-2">
            <template v-if="source.data.type === 'github'">
              <div class="grid grid-cols-3 gap-2">
                <UInput
                  v-model="source.data.repo"
                  placeholder="owner/repo"
                  size="sm"
                  icon="i-simple-icons-github"
                  autocomplete="off"
                />
                <UInput
                  v-model="source.data.branch"
                  placeholder="main"
                  size="sm"
                  icon="i-lucide-git-branch"
                  autocomplete="off"
                />
                <UInput
                  v-model="source.data.contentPath"
                  placeholder="docs/content"
                  size="sm"
                  icon="i-lucide-folder-open"
                  autocomplete="off"
                />
              </div>
            </template>

            <template v-else>
              <div class="grid grid-cols-2 gap-2">
                <UInput
                  v-model="source.data.channelId"
                  placeholder="UCxxxx…"
                  size="sm"
                  icon="i-simple-icons-youtube"
                  autocomplete="off"
                />
                <UInput
                  v-model="source.data.handle"
                  placeholder="@handle"
                  size="sm"
                  icon="i-lucide-at-sign"
                  autocomplete="off"
                />
              </div>
            </template>

            <div class="flex items-center gap-1.5 text-xs text-muted pt-1">
              <UIcon name="i-lucide-folder-output" class="size-3" aria-hidden="true" />
              <span>Output:</span>
              <code class="text-highlighted font-mono text-[11px]">{{ getSnapshotPreview(source) }}</code>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="mb-2 text-center">
      <button
        class="text-xs text-muted hover:text-primary transition-colors inline-flex items-center gap-1.5"
        @click="showQuickImport = !showQuickImport"
      >
        <UIcon name="i-lucide-sparkles" class="size-3" />
        <span>{{ showQuickImport ? 'Hide quick import' : 'Power users: upload config files or screenshots' }}</span>
      </button>
    </div>

    <div class="flex items-center justify-end gap-2 pt-4 border-t border-default">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        to="/admin"
      >
        Cancel
      </UButton>
      <UButton
        size="sm"
        :disabled="!hasValidSources || isExtracting"
        :loading="isSubmitting"
        @click="saveAll"
      >
        Create {{ validSourcesCount }}
      </UButton>
    </div>
  </div>
</template>
