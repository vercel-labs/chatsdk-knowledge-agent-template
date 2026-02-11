<script setup lang="ts">
definePageMeta({ layout: false, auth: 'guest' })

const mode = ref<'signin' | 'signup'>('signin')
const loading = ref(false)
const error = ref('')

const name = ref('')
const email = ref('')
const password = ref('')

const { signIn, signUp } = useUserSession()

async function onSubmit() {
  loading.value = true
  error.value = ''

  try {
    if (mode.value === 'signup') {
      await signUp.email({ name: name.value, email: email.value, password: password.value })
    }
    else {
      await signIn.email({ email: email.value, password: password.value })
    }
    await navigateTo('/', { replace: true })
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Something went wrong. Please try again.'
  }
  finally {
    loading.value = false
  }
}

function onGitHub() {
  signIn.social({ provider: 'github' })
}
</script>

<template>
  <div class="bg-default min-h-dvh flex items-center justify-center px-4">
    <div class="max-w-sm w-full space-y-6">
      <div class="flex flex-col items-center gap-2">
        <UIcon name="i-custom-savoir" class="size-10 text-primary" />
        <h1 class="text-2xl font-bold font-pixel tracking-wide text-highlighted">
          Savoir
        </h1>
      </div>

      <div class="ring ring-default rounded-xl bg-elevated p-8 space-y-6">
        <!-- Tab toggle -->
        <div class="flex rounded-lg bg-default p-1 gap-1">
          <button
            class="flex-1 text-sm font-medium py-1.5 rounded-md transition-colors"
            :class="mode === 'signin' ? 'bg-elevated text-highlighted shadow-sm' : 'text-muted hover:text-highlighted'"
            @click="mode = 'signin'"
          >
            Sign in
          </button>
          <button
            class="flex-1 text-sm font-medium py-1.5 rounded-md transition-colors"
            :class="mode === 'signup' ? 'bg-elevated text-highlighted shadow-sm' : 'text-muted hover:text-highlighted'"
            @click="mode = 'signup'"
          >
            Sign up
          </button>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          icon="i-lucide-circle-alert"
          :close="{
            color: 'error',
            variant: 'link'
          }"
          @close="error = ''"
        />

        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField v-if="mode === 'signup'" label="Name">
            <UInput
              v-model="name"
              placeholder="Your name"
              autofocus
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              :autofocus="mode === 'signin'"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            :label="mode === 'signin' ? 'Sign in' : 'Create account'"
            block
            size="lg"
            :loading
          />
        </form>

        <USeparator label="or" />

        <UButton
          label="Continue with GitHub"
          icon="i-simple-icons-github"
          color="neutral"
          variant="subtle"
          block
          size="lg"
          @click="onGitHub"
        />
      </div>
    </div>
  </div>
</template>
