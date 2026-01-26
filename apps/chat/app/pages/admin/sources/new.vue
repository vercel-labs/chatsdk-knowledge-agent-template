<script setup lang="ts">
import type { SourceOcrItem } from '~/shared/utils/source-ocr'

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

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const router = useRouter()
const toast = useToast()

const isSubmitting = ref(false)
const isExtracting = ref(false)
const isDragging = ref(false)
const pendingFiles = ref<PendingFile[]>([])
const sources = ref<ExtractedSource[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

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
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      pendingFiles.value.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        type: 'image',
      })
    } else if (isConfigFile(file)) {
      pendingFiles.value.push({
        id: crypto.randomUUID(),
        file,
        type: 'config',
      })
    }
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

    // Clear pending files after extraction
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
  sources.value = sources.value.filter(s => s.id !== id)
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
      console.error('Failed to create source:', error)
    }
  }

  isSubmitting.value = false

  if (created > 0) {
    toast.add({
      title: `${created} source${created > 1 ? 's' : ''} created`,
      icon: 'i-lucide-check',
    })
    router.push('/admin/sources')
  } else {
    toast.add({
      title: 'Failed to create sources',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const typeOptions = [
  { label: 'GitHub', value: 'github', icon: 'i-simple-icons-github' },
  { label: 'YouTube', value: 'youtube', icon: 'i-simple-icons-youtube' },
]

const hasValidSources = computed(() => sources.value.some(s => s.data.label))
</script>

<template>
  <UContainer class="py-10 max-w-3xl">
    <header class="mb-8">
      <div class="flex items-center gap-3 mb-1">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="xs"
          to="/admin/sources"
        />
        <h1 class="text-lg font-semibold text-highlighted">
          Add Sources
        </h1>
      </div>
      <p class="text-[13px] text-muted ml-9">
        Upload screenshots or config files to auto-extract sources
      </p>
    </header>

    <div class="space-y-6">
      <!-- Drop Zone -->
      <div
        class="relative p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer"
        :class="[
          isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-default hover:border-muted hover:bg-muted/5',
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
          <div class="size-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <UIcon
              :name="isDragging ? 'i-lucide-download' : 'i-lucide-files'"
              class="size-7 text-muted transition-transform"
              :class="{ 'scale-110': isDragging }"
            />
          </div>
          <p class="text-sm font-medium text-highlighted mb-1">
            Drop files here
          </p>
          <p class="text-xs text-muted">
            Screenshots, .ts, .json, .yml, .yaml
          </p>
        </div>
      </div>

      <!-- Pending Files -->
      <div v-if="pendingFiles.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-highlighted">
            Files to extract ({{ pendingFiles.length }})
          </h2>
          <UButton
            icon="i-lucide-sparkles"
            size="xs"
            :loading="isExtracting"
            @click="extractAll"
          >
            Extract sources
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
              class="w-20 h-14 rounded-lg border border-default overflow-hidden"
            >
              <img
                :src="item.previewUrl"
                :alt="item.file.name"
                class="w-full h-full object-cover"
              >
            </div>
            <div
              v-else
              class="w-20 h-14 rounded-lg border border-default bg-muted/30 flex flex-col items-center justify-center gap-1"
            >
              <UIcon :name="getFileIcon(item)" class="size-5 text-muted" />
              <span class="text-[10px] text-muted truncate max-w-16 px-1">{{ item.file.name }}</span>
            </div>
            <button
              class="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="removeFile(item.id)"
            >
              <UIcon name="i-lucide-x" class="size-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Extracted Sources -->
      <div v-if="sources.length > 0" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-highlighted">
            Sources ({{ sources.length }})
          </h2>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="addManualSource"
          >
            Add manually
          </UButton>
        </div>

        <div class="space-y-3">
          <div
            v-for="source in sources"
            :key="source.id"
            class="p-4 rounded-xl border border-default bg-default/50"
          >
            <div class="flex items-start gap-4 mb-3">
              <div class="flex-1 min-w-0">
                <div v-if="source.confidence < 1" class="text-xs text-muted mb-2">
                  {{ Math.round(source.confidence * 100) }}% confidence
                </div>

                <div class="grid grid-cols-3 gap-3">
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
                    />
                  </div>
                </div>
              </div>

              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="removeSource(source.id)"
              />
            </div>

            <div class="space-y-3">
              <template v-if="source.data.type === 'github'">
                <div class="grid grid-cols-3 gap-3">
                  <UInput
                    v-model="source.data.repo"
                    placeholder="owner/repo"
                    size="sm"
                    icon="i-simple-icons-github"
                  />
                  <UInput
                    v-model="source.data.branch"
                    placeholder="main"
                    size="sm"
                    icon="i-lucide-git-branch"
                  />
                  <UInput
                    v-model="source.data.contentPath"
                    placeholder="docs/content"
                    size="sm"
                    icon="i-lucide-folder-open"
                  />
                </div>
              </template>

              <template v-else>
                <div class="grid grid-cols-2 gap-3">
                  <UInput
                    v-model="source.data.channelId"
                    placeholder="UCxxxx..."
                    size="sm"
                    icon="i-simple-icons-youtube"
                  />
                  <UInput
                    v-model="source.data.handle"
                    placeholder="@handle"
                    size="sm"
                    icon="i-lucide-at-sign"
                  />
                </div>
              </template>

              <div class="flex items-center gap-2 text-xs text-muted">
                <UIcon name="i-lucide-package" class="size-3.5" />
                <span>Snapshot:</span>
                <code class="text-highlighted font-mono">{{ getSnapshotPreview(source) }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="sources.length === 0 && pendingFiles.length === 0"
        class="text-center py-8"
      >
        <p class="text-sm text-muted mb-3">
          No sources yet
        </p>
        <UButton
          icon="i-lucide-plus"
          size="sm"
          color="neutral"
          variant="outline"
          @click="addManualSource"
        >
          Add manually
        </UButton>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t border-default">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          to="/admin/sources"
        />
        <UButton
          :label="`Create ${sources.filter(s => s.data.label).length} Source${sources.filter(s => s.data.label).length !== 1 ? 's' : ''}`"
          :loading="isSubmitting"
          :disabled="!hasValidSources || isExtracting"
          @click="saveAll"
        />
      </div>
    </div>
  </UContainer>
</template>
