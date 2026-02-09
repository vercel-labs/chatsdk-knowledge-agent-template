<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
})
</script>

<template>
  <UDashboardPanel id="admin-content">
    <template #body>
      <NuxtPage />
    </template>
  </UDashboardPanel>
</template>
