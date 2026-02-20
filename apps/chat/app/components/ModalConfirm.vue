<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
}>(), {
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
})

const emit = defineEmits<{ close: [boolean] }>()
</script>

<template>
  <UModal
    :title
    :description
    :ui="{
      footer: 'flex-row-reverse justify-start'
    }"
    :close="false"
    :dismissible="false"
  >
    <template #footer>
      <UButton :label="confirmLabel" @click="emit('close', true)" />
      <UButton
        color="neutral"
        variant="ghost"
        :label="cancelLabel"
        @click="emit('close', false)"
      />
    </template>
  </UModal>
</template>
