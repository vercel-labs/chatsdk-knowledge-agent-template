<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

interface Props {
  size?: number
  dotSize?: number
  gap?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 5,
  dotSize: 2,
  gap: 2,
})

const totalDots = computed(() => props.size * props.size)
const activeDots = ref<Set<number>>(new Set())

const patterns = [
  // Spiral pattern from outside to center
  [[0], [1], [2], [3], [4], [9], [14], [19], [24], [23], [22], [21], [20], [15], [10], [5], [6], [7], [8], [13], [18], [17], [16], [11], [12]],

  // Vertical waves
  [[0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24]],

  // Center expand
  [[12], [6, 7, 8, 11, 13, 16, 17, 18], [1, 2, 3, 5, 9, 10, 14, 15, 19, 21, 22, 23], [0, 4, 20, 24]],

  // Horizontal waves
  [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24]],

  // Corners
  [[0], [4], [24], [20], [12]],

  // Cross pattern
  [[2, 10, 11, 12, 13, 14, 22], [6, 7, 8, 16, 17, 18], [0, 1, 3, 4, 5, 9, 15, 19, 20, 21, 23, 24]],

  // Diagonal
  [[0], [1, 5], [2, 6, 10], [3, 7, 11, 15], [4, 8, 12, 16, 20], [9, 13, 17, 21], [14, 18, 22], [19, 23], [24]],

  // Random clusters
  [[6, 7, 8, 11, 12, 13, 16, 17, 18], [1, 3, 5, 9, 10, 14, 15, 19, 21, 23], [0, 2, 4, 20, 22, 24]],

  // Checkerboard
  [
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
    [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]
  ],

  // Rain drops (columns falling one by one)
  [[0], [5], [10], [15], [20], [1], [6], [11], [16], [21], [2], [7], [12], [17], [22], [3], [8], [13], [18], [23], [4], [9], [14], [19], [24]],

  // Square outline inwards
  [
    [0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 22, 21, 20, 15, 10, 5],
    [6, 7, 8, 13, 18, 17, 16, 11],
    [12]
  ],

  // Zigzag rows
  [
    [0, 1, 2, 3, 4],
    [9, 8, 7, 6, 5],
    [10, 11, 12, 13, 14],
    [19, 18, 17, 16, 15],
    [20, 21, 22, 23, 24]
  ],

  // Pulsating fill - all on, then all off, then center only, then outwards
  [
    Array.from({ length: 25 }, (_, i) => i), // all on
    [], // all off
    [12],
    [6, 7, 8, 11, 13, 16, 17, 18, 12],
    [0, 4, 20, 24, 12],
    Array.from({ length: 25 }, (_, i) => i)
  ],

  // Arrow right
  [[0, 5, 10, 15, 20], [6, 11, 16, 21], [12, 17, 22], [13, 18, 23], [14, 19, 24]],

  // Arrow left
  [[4, 9, 14, 19, 24], [3, 8, 13, 18], [2, 7, 12, 17], [1, 6, 11, 16], [0, 5, 10, 15, 20]],

  // X pattern
  [[0, 4, 6, 8, 12, 16, 18, 20, 24], [1, 3, 7, 11, 13, 17, 21, 23], [2, 12, 22], [5, 15], [9, 19]],

  // Spiral in reverse (center to outside)
  [[12], [11, 13, 7, 17], [6, 8, 16, 18], [1, 2, 3, 5, 9, 10, 14, 15, 19, 21, 22, 23], [0, 4, 20, 24]],
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
      class="rounded-full bg-current transition-all duration-150 ease-out"
      :class="activeDots.has(i - 1) ? 'opacity-100 scale-115' : 'opacity-15 scale-75'"
      :style="dotStyle"
    />
  </div>
</template>
