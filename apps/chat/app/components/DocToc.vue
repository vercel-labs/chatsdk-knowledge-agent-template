<script setup lang="ts">
interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}

const props = defineProps<{
  links: TocLink[]
}>()

const idMap = ref<Record<string, string>>({})
const activeIds = ref<Set<string>>(new Set())
const listEl = ref<HTMLElement>()
const indicatorStyle = ref({ top: '0px', height: '0px', opacity: 0 })

let cleanup: (() => void) | null = null
let headingEls: HTMLElement[] = []
let scrollContainer: HTMLElement | null = null

function realId(tocId: string): string {
  return idMap.value[tocId] || tocId
}

function isActive(tocId: string): boolean {
  return activeIds.value.has(realId(tocId))
}

function discoverHeadings() {
  if (!scrollContainer) return
  headingEls = Array.from(scrollContainer.querySelectorAll<HTMLElement>('h2[id], h3[id]'))

  const map: Record<string, string> = {}
  let idx = 0
  for (const link of props.links) {
    if (idx < headingEls.length) map[link.id] = headingEls[idx++]!.id
    for (const child of link.children || []) {
      if (idx < headingEls.length) map[child.id] = headingEls[idx++]!.id
    }
  }
  idMap.value = map
}

function updateActive() {
  if (!scrollContainer || headingEls.length === 0) return
  const containerRect = scrollContainer.getBoundingClientRect()

  const visible = new Set<string>()

  for (let i = 0; i < headingEls.length; i++) {
    const el = headingEls[i]!
    const nextEl = headingEls[i + 1]
    const headingTop = el.getBoundingClientRect().top
    const sectionBottom = nextEl?.getBoundingClientRect().top ?? Infinity

    if (sectionBottom > containerRect.top && headingTop < containerRect.bottom) {
      visible.add(el.id)
    }
  }

  activeIds.value = visible
  nextTick(updateIndicator)
}

function updateIndicator() {
  if (!listEl.value) return

  const buttons = listEl.value.querySelectorAll<HTMLElement>('[data-toc-active="true"]')
  if (buttons.length === 0) {
    indicatorStyle.value = { top: '0px', height: '0px', opacity: 0 }
    return
  }

  const listRect = listEl.value.getBoundingClientRect()
  const firstRect = buttons[0]!.getBoundingClientRect()
  const lastRect = buttons[buttons.length - 1]!.getBoundingClientRect()

  indicatorStyle.value = {
    top: `${firstRect.top - listRect.top}px`,
    height: `${lastRect.bottom - firstRect.top}px`,
    opacity: 1,
  }
}

function setup(): boolean {
  if (cleanup) cleanup()

  const tocTarget = document.getElementById('doc-toc-target')
  scrollContainer = tocTarget?.previousElementSibling as HTMLElement | null
  if (!scrollContainer) return false

  discoverHeadings()
  if (headingEls.length === 0) return false

  updateActive()
  scrollContainer.addEventListener('scroll', updateActive, { passive: true })
  cleanup = () => scrollContainer?.removeEventListener('scroll', updateActive)
  return true
}

onMounted(() => {
  if (setup()) return

  let attempts = 0
  const interval = setInterval(() => {
    attempts++
    if (setup() || attempts > 20) clearInterval(interval)
  }, 100)

  onUnmounted(() => {
    clearInterval(interval)
    cleanup?.()
  })
})

function scrollTo(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <nav class="text-sm">
    <p class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
      On this page
    </p>

    <ul ref="listEl" class="space-y-1 border-l border-default relative">
      <div
        class="absolute left-0 w-0.5 -ml-px bg-primary rounded-full transition-all duration-200"
        :style="indicatorStyle"
      />

      <li v-for="link in links" :key="link.id">
        <button
          :data-toc-active="isActive(link.id)"
          class="block w-full text-left pl-3 py-0.5 transition-colors text-xs"
          :class="isActive(link.id) ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
          @click="scrollTo(realId(link.id))"
        >
          {{ link.text }}
        </button>

        <ul v-if="link.children?.length" class="space-y-0.5">
          <li v-for="child in link.children" :key="child.id">
            <button
              :data-toc-active="isActive(child.id)"
              class="block w-full text-left pl-6 py-0.5 transition-colors text-xs"
              :class="isActive(child.id) ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
              @click="scrollTo(realId(child.id))"
            >
              {{ child.text }}
            </button>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
