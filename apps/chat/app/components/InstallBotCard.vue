<script setup lang="ts">
const { loggedIn } = useUserSession()
const { dismissed, githubUrl, discordUrl, hasAny, dismiss } = useInstallBot()

const visible = computed(() => loggedIn.value && !dismissed.value && hasAny.value)

const cardRef = useTemplateRef<HTMLElement>('card')
const rotateX = ref(0)
const rotateY = ref(0)
const shineX = ref(50)
const shineY = ref(50)
const isHovering = ref(false)

function onMouseMove(e: MouseEvent) {
  const el = cardRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  rotateX.value = (y - 0.5) * -20
  rotateY.value = (x - 0.5) * 20
  shineX.value = x * 100
  shineY.value = y * 100
}

function onMouseEnter() {
  isHovering.value = true
}

function onMouseLeave() {
  isHovering.value = false
  rotateX.value = 0
  rotateY.value = 0
  shineX.value = 50
  shineY.value = 50
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    leave-active-class="transition-all duration-200 ease-in"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="visible"
      class="m-2"
      style="perspective: 800px"
    >
      <div
        ref="card"
        class="holo-border rounded-xl p-px relative cursor-default"
        :style="{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: isHovering ? 'transform 0.1s ease-out' : 'transform 0.4s ease-out',
        }"
        @mousemove="onMouseMove"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      >
        <div
          class="holo-border-shine"
          :style="{
            opacity: isHovering ? 1 : 0.3,
            background: `radial-gradient(circle at ${shineX}% ${shineY}%, white 0%, oklch(90% 0 0 / 0.5) 30%, transparent 70%)`,
          }"
        />

        <div class="holo-inner p-3 relative overflow-hidden">
          <div
            class="holo-shine"
            :style="{
              opacity: isHovering ? 1 : 0,
              background: `radial-gradient(circle at ${shineX}% ${shineY}%, oklch(100% 0 0 / 0.12) 0%, oklch(95% 0 0 / 0.06) 35%, transparent 70%)`,
            }"
          />

          <div class="relative">
            <div class="flex items-center justify-between mb-1.5">
              <p class="text-xs font-medium text-highlighted leading-tight">
                Install our bots
              </p>
              <button
                class="shrink-0 text-dimmed hover:text-highlighted transition-colors p-0.5"
                @click="dismiss"
              >
                <UIcon name="i-lucide-x" class="size-3.5" />
              </button>
            </div>

            <p class="text-[11px] text-muted leading-snug mb-2.5">
              Get AI answers on your favorite platforms.
            </p>

            <div class="flex items-center gap-1.5">
              <UButton
                v-if="githubUrl"
                label="GitHub"
                icon="i-simple-icons-github"
                size="xs"
                variant="outline"
                color="neutral"
                :to="githubUrl"
                target="_blank"
              />
              <UButton
                v-if="discordUrl"
                label="Discord"
                icon="i-simple-icons-discord"
                size="xs"
                variant="outline"
                color="neutral"
                :to="discordUrl"
                target="_blank"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.holo-border {
  background: oklch(30% 0 0 / 0.6);
  transform-style: preserve-3d;
  will-change: transform;
}

.holo-border-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity 0.4s ease;
  z-index: 0;
}

.holo-inner {
  background: var(--ui-bg-elevated);
  border-radius: calc(var(--radius-xl, 0.75rem) - 1px);
  position: relative;
  z-index: 1;
}

.holo-shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 2;
}
</style>
