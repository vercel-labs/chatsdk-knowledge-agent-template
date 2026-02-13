<script setup lang="ts">
definePageMeta({ layout: false, auth: 'guest' })

useSeoMeta({ title: 'Sign in' })

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
    } else {
      await signIn.email({ email: email.value, password: password.value })
    }
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function onGitHub() {
  signIn.social({ provider: 'github' })
}
</script>

<template>
  <div class="login-page bg-default min-h-dvh flex flex-col items-center justify-center px-4 overflow-hidden relative">
    <div class="dot-grid absolute inset-0 pointer-events-none select-none" />

    <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-primary-500/15 rounded-full blur-[250px] pointer-events-none select-none animate-glow" />
    <div class="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[250px] bg-primary-400/10 rounded-full blur-[180px] pointer-events-none select-none" />

    <div class="relative z-10 flex flex-col items-center gap-3 mb-10">
      <div class="relative">
        <div class="absolute inset-0 bg-primary-500/20 rounded-full blur-xl scale-150" />
        <UIcon name="i-custom-savoir" class="relative size-12 text-primary" />
      </div>
      <h1 class="text-3xl font-bold font-pixel tracking-wide text-highlighted">
        Savoir
      </h1>
      <p class="text-muted text-sm/6 text-center max-w-xs">
        Your intelligent AI assistant for knowledge and insights.
      </p>
    </div>

    <div class="relative z-10 w-full max-w-sm">
      <span class="cross absolute -top-px -left-px size-px" />
      <span class="cross absolute -top-px -right-px size-px" />
      <span class="cross absolute -bottom-px -left-px size-px" />
      <span class="cross absolute -bottom-px -right-px size-px" />

      <div class="relative overflow-hidden ring ring-default bg-elevated/50 backdrop-blur-md p-8 space-y-5">
        <div class="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-primary-500/40 to-transparent" />

        <div class="flex bg-default/80 p-1 gap-1">
          <button
            class="flex-1 text-sm font-medium py-2 transition-all duration-200 cursor-pointer relative"
            :class="mode === 'signin' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-dimmed'"
            @click="mode = 'signin'"
          >
            Sign in
          </button>
          <button
            class="flex-1 text-sm font-medium py-2 transition-all duration-200 cursor-pointer relative"
            :class="mode === 'signup' ? 'bg-elevated text-highlighted shadow-xs' : 'text-muted hover:text-dimmed'"
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
          :close="{ color: 'error', variant: 'link' }"
          @close="error = ''"
        />

        <UButton
          label="Continue with GitHub"
          icon="i-simple-icons-github"
          color="neutral"
          variant="subtle"
          block
          size="lg"
          @click="onGitHub"
        />

        <div class="flex items-center gap-3">
          <div class="flex-1 h-px bg-accented" />
          <span class="text-xs text-muted select-none whitespace-nowrap">or with email</span>
          <div class="flex-1 h-px bg-accented" />
        </div>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="name-field-wrapper" :class="mode === 'signup' ? 'expanded' : 'collapsed'">
            <div class="name-field-inner">
              <UFormField label="Name">
                <UInput
                  v-model="name"
                  placeholder="Your name"
                  size="lg"
                  class="w-full"
                  :tabindex="mode === 'signup' ? 0 : -1"
                />
              </UFormField>
            </div>
          </div>

          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
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
      </div>
    </div>

    <p class="relative z-10 mt-8 text-xs text-muted/60">
      By continuing, you agree to our terms of service.
    </p>
  </div>
</template>

<style scoped>
.dot-grid {
  background-image: radial-gradient(circle, var(--ui-border-muted) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(ellipse 50% 60% at 50% 40%, black 20%, transparent 70%);
}

.cross::before,
.cross::after {
  content: '';
  position: absolute;
}

.cross::before {
  top: -4px;
  width: 1px;
  height: 9px;
  background: var(--ui-border-accented);
}

.cross::after {
  left: -4px;
  width: 9px;
  height: 1px;
  background: var(--ui-border-accented);
}

/* Name field smooth expand/collapse with CSS grid trick */
.name-field-wrapper {
  display: grid;
  transition: grid-template-rows 250ms ease, opacity 250ms ease;
}

.name-field-wrapper.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
}

.name-field-wrapper.collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}

.name-field-inner {
  overflow: hidden;
}

.name-field-wrapper.collapsed .name-field-inner {
  padding-bottom: 0;
}

.name-field-wrapper.expanded .name-field-inner {
  padding-bottom: 0;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.animate-glow {
  animation: glow-pulse 6s ease-in-out infinite;
}
</style>
