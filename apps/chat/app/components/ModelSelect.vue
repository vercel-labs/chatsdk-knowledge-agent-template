<script setup lang="ts">
const { model, models, formatModelName } = useModels()

const providerIcons: Record<string, string> = {
  openai: 'i-simple-icons-openai',
  anthropic: 'i-simple-icons-anthropic',
  google: 'i-simple-icons-google',
  moonshotai: 'i-lucide-moon' // Moonshot doesn't have a simple-icons entry
}

function getProviderIcon(modelId: string) {
  const [provider = ''] = modelId.split('/')
  return providerIcons[provider] || 'i-custom-bot'
}

const items = computed(() => models.map(m => ({
  label: formatModelName(m),
  value: m,
  icon: getProviderIcon(m)
})))
</script>

<template>
  <USelectMenu
    v-model="model"
    :items
    size="sm"
    :icon="getProviderIcon(model)"
    variant="ghost"
    value-key="value"
    class="hover:bg-default focus:bg-default data-[state=open]:bg-default"
    :ui="{
      trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
      content: 'w-auto min-w-max'
    }"
  />
</template>
