<script setup lang="ts">
const props = withDefaults(defineProps<{
  length?: number
  interval?: number
}>(), {
  length: 14,
  interval: 60
})

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomString() {
  return Array.from({ length: props.length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const display = ref(randomString())
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    display.value = randomString()
  }, props.interval)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <span class="text-muted font-mono tracking-wide opacity-50">{{ display }}</span>
</template>
