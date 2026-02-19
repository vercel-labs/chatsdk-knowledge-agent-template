<script setup lang="ts">
useSeoMeta({ title: 'Assistant - Admin' })

const toast = useToast()
const { showError } = useErrorToast()

interface AgentConfig {
  id: string
  name: string
  additionalPrompt: string | null
  responseStyle: 'concise' | 'detailed' | 'technical' | 'friendly'
  language: string
  defaultModel: string | null
  maxStepsMultiplier: number
  temperature: number
  searchInstructions: string | null
  citationFormat: 'inline' | 'footnote' | 'none'
  isActive: boolean
}

const cachedConfig = useState<AgentConfig | null>('admin-agent-config', () => null)

const { data: config, refresh, status } = useLazyFetch<AgentConfig>('/api/agent-config')

if (!config.value && cachedConfig.value) {
  config.value = cachedConfig.value
}
watch(config, (v) => {
  if (v) cachedConfig.value = v 
})

const form = ref<{
  additionalPrompt: string
  responseStyle: 'concise' | 'detailed' | 'technical' | 'friendly'
  language: string
  defaultModel: string
  maxStepsMultiplier: number
  temperature: number
  searchInstructions: string
  citationFormat: 'inline' | 'footnote' | 'none'
}>({
  additionalPrompt: '',
  responseStyle: 'concise',
  language: 'en',
  defaultModel: 'auto',
  maxStepsMultiplier: 1.0,
  temperature: 0.7,
  searchInstructions: '',
  citationFormat: 'inline',
})

const isSaving = ref(false)
const isResetting = ref(false)

watch(config, (newConfig) => {
  if (newConfig) {
    form.value = {
      additionalPrompt: newConfig.additionalPrompt || '',
      responseStyle: newConfig.responseStyle,
      language: newConfig.language,
      defaultModel: newConfig.defaultModel || 'auto',
      maxStepsMultiplier: newConfig.maxStepsMultiplier,
      temperature: newConfig.temperature,
      searchInstructions: newConfig.searchInstructions || '',
      citationFormat: newConfig.citationFormat,
    }
  }
}, { immediate: true })

const responseStyleOptions = [
  { value: 'concise', label: 'Concise', description: 'Short and direct answers' },
  { value: 'detailed', label: 'Detailed', description: 'Full explanations with context' },
  { value: 'technical', label: 'Technical', description: 'For developers, with code examples' },
  { value: 'friendly', label: 'Friendly', description: 'Casual and easy to understand' },
]

const citationFormatOptions = [
  { value: 'inline', label: 'In text', description: 'Show sources as you read' },
  { value: 'footnote', label: 'At the end', description: 'List sources at the bottom' },
  { value: 'none', label: 'Hidden', description: 'Don\'t show sources' },
]

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
]

const modelOptions = [
  { value: 'auto', label: 'Automatic (Recommended)' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Fast' },
  { value: 'google/gemini-3-flash', label: 'Balanced' },
  { value: 'anthropic/claude-opus-4.5', label: 'Advanced' },
]

async function saveConfig() {
  isSaving.value = true
  try {
    await $fetch('/api/agent-config', {
      method: 'PUT',
      body: {
        additionalPrompt: form.value.additionalPrompt || null,
        responseStyle: form.value.responseStyle,
        language: form.value.language,
        defaultModel: form.value.defaultModel === 'auto' ? null : form.value.defaultModel,
        maxStepsMultiplier: form.value.maxStepsMultiplier,
        temperature: form.value.temperature,
        searchInstructions: form.value.searchInstructions || null,
        citationFormat: form.value.citationFormat,
      },
    })
    toast.add({
      title: 'Configuration saved',
      icon: 'i-lucide-check',
    })
    await refresh()
  } catch (e) {
    showError(e, { fallback: 'Failed to save configuration' })
  } finally {
    isSaving.value = false
  }
}

async function resetConfig() {
  isResetting.value = true
  try {
    await $fetch('/api/agent-config/reset', { method: 'POST' })
    toast.add({
      title: 'Configuration reset',
      description: 'Settings have been restored to defaults',
      icon: 'i-lucide-check',
    })
    await refresh()
  } catch (e) {
    showError(e, { fallback: 'Failed to reset configuration' })
  } finally {
    isResetting.value = false
  }
}
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Assistant Settings
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Customize how the AI assistant responds to questions.
      </p>
    </header>

    <div v-if="status === 'pending' && !config" class="space-y-8">
      <div v-for="i in 3" :key="i">
        <USkeleton class="h-3 w-20 mb-3" />
        <div class="rounded-lg border border-default divide-y divide-default">
          <div v-for="j in 2" :key="j" class="flex items-center justify-between px-4 py-3.5">
            <div>
              <USkeleton class="h-4 w-28 mb-1" />
              <USkeleton class="h-3 w-48" />
            </div>
            <USkeleton class="h-8 w-36 rounded-md" />
          </div>
        </div>
      </div>
    </div>

    <form v-else class="space-y-8" @submit.prevent="saveConfig">
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          General
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p class="text-sm text-highlighted">
                Language
              </p>
              <p class="text-xs text-muted">
                The language the assistant will respond in
              </p>
            </div>
            <USelect
              v-model="form.language"
              :items="languageOptions"
              value-key="value"
              class="w-40"
            />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p class="text-sm text-highlighted">
                Intelligence
              </p>
              <p class="text-xs text-muted">
                Choose between speed and quality
              </p>
            </div>
            <USelect
              v-model="form.defaultModel"
              :items="modelOptions"
              value-key="value"
              class="w-48"
            />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p class="text-sm text-highlighted">
                Tone
              </p>
              <p class="text-xs text-muted">
                How the assistant communicates
              </p>
            </div>
            <USelect
              v-model="form.responseStyle"
              :items="responseStyleOptions"
              value-key="value"
              class="w-40"
            />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p class="text-sm text-highlighted">
                Source references
              </p>
              <p class="text-xs text-muted">
                How sources are shown in responses
              </p>
            </div>
            <USelect
              v-model="form.citationFormat"
              :items="citationFormatOptions"
              value-key="value"
              class="w-36"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Tuning
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div class="px-4 py-3">
            <p class="text-sm text-highlighted mb-3">
              Creativity
            </p>
            <USlider
              v-model="form.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-muted mt-1.5">
              <span>Predictable</span>
              <span>Creative</span>
            </div>
          </div>
          <div class="px-4 py-3">
            <p class="text-sm text-highlighted mb-3">
              Search depth
            </p>
            <USlider
              v-model="form.maxStepsMultiplier"
              :min="0.5"
              :max="3"
              :step="0.1"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-muted mt-1.5">
              <span>Quick</span>
              <span>Thorough</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Instructions
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div class="px-4 py-3">
            <p class="text-sm text-highlighted mb-1">
              Custom instructions
            </p>
            <p class="text-xs text-muted mb-3">
              Add rules or guidelines for how the assistant should behave.
            </p>
            <UTextarea
              v-model="form.additionalPrompt"
              placeholder="Example: Always be friendly and patient. When showing code, include comments explaining what it does..."
              :rows="3"
              autoresize
              class="w-full"
            />
          </div>
          <div class="px-4 py-3">
            <p class="text-sm text-highlighted mb-1">
              Search preferences
            </p>
            <p class="text-xs text-muted mb-3">
              Guide how the assistant finds and prioritizes information.
            </p>
            <UTextarea
              v-model="form.searchInstructions"
              placeholder="Example: Focus on official documentation first. Check for the latest version information..."
              :rows="3"
              autoresize
              class="w-full"
            />
          </div>
        </div>
      </section>

      <div class="flex items-center gap-3">
        <UButton
          type="submit"
          :loading="isSaving"
          icon="i-lucide-save"
        >
          Save Changes
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          :loading="isResetting"
          @click="resetConfig"
        >
          Reset to Defaults
        </UButton>
      </div>
    </form>
  </div>
</template>
