<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

interface Props {
  size?: number
  dotSize?: number
  gap?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 4,
  dotSize: 2,
  gap: 2,
})

const totalDots = computed(() => props.size * props.size)
const activeDots = ref<Set<number>>(new Set())

const patterns = [
  [[0], [1], [2], [3], [7], [11], [15], [14], [13], [12], [8], [4], [5], [6], [10], [9]],
  [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]],
  [[5, 6, 9, 10], [1, 4, 7, 8, 11, 14], [0, 3, 12, 15], [1, 4, 7, 8, 11, 14], [5, 6, 9, 10]],
  [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]],
  [[0], [3], [15], [12]],
  [[5, 6, 9, 10], [1, 2, 4, 7, 8, 11, 13, 14], [0, 3, 12, 15]],
  [[0], [1], [2], [3], [7], [6], [5], [4], [8], [9], [10], [11], [15], [14], [13], [12]],
  [[0], [1, 4], [2, 5, 8], [3, 6, 9, 12], [7, 10, 13], [11, 14], [15]],
]

let patternIndex = 0
let stepIndex = 0

function nextStep() {
  const pattern = patterns[patternIndex]
  if (!pattern) return

  activeDots.value = new Set(pattern[stepIndex])
  stepIndex++

  if (stepIndex >= pattern.length) {
    stepIndex = 0
    patternIndex = (patternIndex + 1) % patterns.length
  }
}

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${props.size}, 1fr)`,
  gap: `${props.gap}px`,
  width: `${props.size * props.dotSize + (props.size - 1) * props.gap}px`,
  height: `${props.size * props.dotSize + (props.size - 1) * props.gap}px`,
}))

const dotStyle = computed(() => ({
  width: `${props.dotSize}px`,
  height: `${props.dotSize}px`,
}))

useIntervalFn(nextStep, 120, { immediateCallback: true })
</script>

<template>
  <div :style="gridStyle">
    <span
      v-for="i in totalDots"
      :key="i"
      class="rounded-[0.5px] bg-current transition-opacity duration-100"
      :class="activeDots.has(i - 1) ? 'opacity-100' : 'opacity-20'"
      :style="dotStyle"
    />
  </div>
</template>
