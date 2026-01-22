<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { SourcesResponse } from '@savoir/sdk'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const appConfig = useAppConfig()
const { user, clear } = useUserSession()
const toast = useToast()

const colors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const neutrals = ['slate', 'gray', 'zinc', 'neutral', 'stone']

const { data: sources } = useLazyFetch<SourcesResponse>('/api/admin/sources')

async function triggerSync() {
  try {
    await $fetch('/api/admin/sync', { method: 'POST' })
    toast.add({
      title: 'Sync started',
      description: 'Documentation sync workflow has been triggered.',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Sync failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error',
    })
  }
}

async function triggerSyncSource(sourceId: string, label: string) {
  try {
    await $fetch(`/api/admin/sync/${sourceId}`, { method: 'POST' })
    toast.add({
      title: 'Sync started',
      description: `Sync workflow for "${label}" has been triggered.`,
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Sync failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error',
    })
  }
}

async function triggerSnapshot() {
  try {
    await $fetch('/api/admin/snapshot', { method: 'POST' })
    toast.add({
      title: 'Snapshot started',
      description: 'Snapshot creation workflow has been triggered.',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Snapshot failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error',
    })
  }
}

const items = computed<DropdownMenuItem[][]>(() => ([
  [
    {
      type: 'label',
      label: user.value?.name || user.value?.username,
      avatar: {
        src: user.value?.avatar,
        alt: user.value?.name || user.value?.username
      }
    }
  ], [
    {
      label: 'Theme',
      icon: 'i-lucide-palette',
      children: [
        {
          label: 'Primary',
          slot: 'chip',
          chip: appConfig.ui.colors.primary,
          content: {
            align: 'center',
            collisionPadding: 16
          },
          children: colors.map(color => ({
            label: color,
            chip: color,
            slot: 'chip',
            checked: appConfig.ui.colors.primary === color,
            type: 'checkbox',
            onSelect: (e: Event) => {
              e.preventDefault()

              appConfig.ui.colors.primary = color
            }
          }))
        }, {
          label: 'Neutral',
          slot: 'chip',
          chip: appConfig.ui.colors.neutral === 'neutral' ? 'old-neutral' : appConfig.ui.colors.neutral,
          content: {
            align: 'end',
            collisionPadding: 16
          },
          children: neutrals.map(color => ({
            label: color,
            chip: color === 'neutral' ? 'old-neutral' : color,
            slot: 'chip',
            type: 'checkbox',
            checked: appConfig.ui.colors.neutral === color,
            onSelect: (e: Event) => {
              e.preventDefault()

              appConfig.ui.colors.neutral = color
            }
          }))
        }
      ]
    }, {
      label: 'Appearance',
      icon: 'i-lucide-sun-moon',
      children: [
        {
          label: 'Light',
          icon: 'i-lucide-sun',
          type: 'checkbox',
          checked: colorMode.value === 'light',
          onSelect: (e: Event) => {
            e.preventDefault()

            colorMode.preference = 'light'
          }
        }, {
          label: 'Dark',
          icon: 'i-lucide-moon',
          type: 'checkbox',
          checked: colorMode.value === 'dark',
          onUpdateChecked(checked: boolean) {
            if (checked) {
              colorMode.preference = 'dark'
            }
          },
          onSelect(e: Event) {
            e.preventDefault()
          }
        }
      ]
    }
  ], [
    {
      label: 'Templates',
      icon: 'i-lucide-layout-template',
      children: [
        {
          label: 'Starter',
          to: 'https://starter-template.nuxt.dev/'
        }, {
          label: 'Landing',
          to: 'https://landing-template.nuxt.dev/'
        }, {
          label: 'Docs',
          to: 'https://docs-template.nuxt.dev/'
        }, {
          label: 'SaaS',
          to: 'https://saas-template.nuxt.dev/'
        }, {
          label: 'Dashboard',
          to: 'https://dashboard-template.nuxt.dev/'
        }, {
          label: 'Chat',
          to: 'https://chat-template.nuxt.dev/',
          color: 'primary',
          checked: true,
          type: 'checkbox'
        }, {
          label: 'Portfolio',
          to: 'https://portfolio-template.nuxt.dev/'
        }, {
          label: 'Changelog',
          to: 'https://changelog-template.nuxt.dev/'
        }
      ]
    }
  ], [
    {
      label: 'Documentation',
      icon: 'i-lucide-book-open',
      to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
      target: '_blank'
    }, {
      label: 'GitHub repository',
      icon: 'i-simple-icons-github',
      to: 'https://github.com/nuxt-ui-templates/chat',
      target: '_blank'
    }
  ], [
    {
      label: 'Admin',
      icon: 'i-lucide-settings',
      children: [
        {
          label: 'Sync all',
          icon: 'i-lucide-refresh-cw',
          onSelect: triggerSync,
        },
        {
          label: 'Sync source',
          icon: 'i-lucide-git-branch',
          children: sources.value ? [
            ...sources.value.github.sources.map(source => ({
              label: source.label,
              icon: 'i-simple-icons-github',
              onSelect: () => triggerSyncSource(source.id, source.label),
            })),
            ...sources.value.youtube.sources.map(source => ({
              label: source.label,
              icon: 'i-simple-icons-youtube',
              onSelect: () => triggerSyncSource(source.id, source.label),
            })),
          ] : [{ label: 'Loading...', disabled: true }],
        },
        {
          label: 'Create snapshot',
          icon: 'i-lucide-camera',
          onSelect: triggerSnapshot,
        },
      ],
    },
  ], [
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      onSelect() {
        clear()
        navigateTo('/')
      }
    }
  ]
]))
</script>

<template>
  <UDropdownMenu
    :items
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        label: collapsed ? undefined : (user?.name || user?.username),
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      :avatar="{
        src: user?.avatar || undefined,
        alt: user?.name || user?.username
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />

    <template #chip-leading="{ item }">
      <div class="inline-flex items-center justify-center shrink-0 size-5">
        <span
          class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>
