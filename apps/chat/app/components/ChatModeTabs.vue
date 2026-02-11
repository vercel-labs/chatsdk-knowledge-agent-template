<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { isAdmin } = useAdmin()
const { mode, setMode } = useChatMode()

const items: TabsItem[] = [
  {
    label: 'Chat',
    icon: 'i-lucide-message-circle',
    value: 'chat',
  },
  {
    label: 'Admin',
    icon: 'i-lucide-shield',
    value: 'admin',
  },
]

function onUpdate(value: string | number) {
  const newMode = value as 'chat' | 'admin'
  const currentMode = mode.value
  setMode(newMode)
  if (newMode !== currentMode) {
    navigateTo('/')
  }
}
</script>

<template>
  <div v-if="isAdmin" class="flex justify-center">
    <UTabs
      :items
      :model-value="mode"
      :content="false"
      variant="pill"
      size="sm"
      color="neutral"
      :ui="{
        root: 'w-auto',
        list: 'bg-transparent',
      }"
      @update:model-value="onUpdate"
    />
  </div>
</template>
