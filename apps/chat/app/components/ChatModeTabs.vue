<script setup lang="ts">
const { isAdmin } = useAdmin()
const { mode, setMode } = useChatMode()

const items = [
  {
    label: 'Chat',
    icon: 'i-custom-chat',
    value: 'chat',
  },
  {
    label: 'Admin',
    icon: 'i-custom-shield',
    value: 'admin',
  },
]

const tabRefs = useTemplateRef<HTMLButtonElement[]>('tabRefs')
const indicatorStyle = ref<Record<string, string>>({})

function updateIndicator() {
  const idx = items.findIndex(i => i.value === mode.value)
  const el = tabRefs.value?.[idx]
  if (!el) return
  indicatorStyle.value = {
    width: `${el.offsetWidth}px`,
    transform: `translateX(${el.offsetLeft}px)`,
  }
}

watch(mode, () => nextTick(updateIndicator))
onMounted(updateIndicator)

function onUpdate(value: string) {
  const currentMode = mode.value
  setMode(value as 'chat' | 'admin')
  if (value !== currentMode) {
    navigateTo('/')
  }
}
</script>

<template>
  <div v-if="isAdmin" class="relative flex items-center gap-1">
    <div
      class="absolute top-0 left-0 h-full rounded-md bg-elevated transition-all duration-200 ease-out"
      :style="indicatorStyle"
    />
    <button
      v-for="item in items"
      :key="item.value"
      ref="tabRefs"
      class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors"
      :class="mode === item.value ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
      @click="onUpdate(item.value)"
    >
      <UIcon :name="item.icon" class="size-3" />
      {{ item.label }}
    </button>
  </div>
</template>
