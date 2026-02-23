<script setup lang="ts">
import { z } from 'zod'
import { Circle, DotGrid, Glow, ProgressiveBlur, Saturation, Shader, Swirl } from 'shaders/vue'

const appConfig = useAppConfig()

definePageMeta({ layout: false, auth: 'guest' })

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string
const ogImage = siteUrl ? `${siteUrl.replace(/\/$/, '')}/og.jpg` : '/og.jpg'

useSeoMeta({
  title: 'Sign in',
  description: appConfig.app.description,
  ogTitle: appConfig.app.name,
  ogDescription: appConfig.app.description,
  ogImage,
  twitterImage: ogImage,
  twitterCard: 'summary_large_image',
})

const route = useRoute()
const mode = ref<'signin' | 'signup'>('signin')
const loading = ref(false)
const githubLoading = ref(false)
const error = ref('')
const { signIn, signUp } = useUserSession()

const oauthErrors: Record<string, string> = {
  access_denied: 'Access denied by GitHub.',
  server_error: 'GitHub encountered an error. Please try again.',
  temporarily_unavailable: 'GitHub is temporarily unavailable. Please try again later.',
}

const shaderColors = reactive({ swirlA: '', swirlB: '', circle: '', dots: '', rays: '' })

function primary(shade: number) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-primary-${shade}`).trim()
}

onMounted(() => {
  Object.assign(shaderColors, {
    swirlA: primary(700),
    swirlB: primary(500),
    circle: primary(100),
    dots: primary(300),
    rays: primary(500),
  })

  const queryError = route.query.error as string | undefined
  if (queryError) {
    error.value = oauthErrors[queryError] || `Authentication error: ${queryError}`
  }
})

const state = reactive({ name: '', email: '', password: '' })

const signInSchema = z.object({
  name: z.string().optional(),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const schema = computed(() => mode.value === 'signup' ? signUpSchema : signInSchema)

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    if (mode.value === 'signup') {
      await signUp.email({ name: state.name, email: state.email, password: state.password })
    } else {
      await signIn.email({ email: state.email, password: state.password })
    }
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function onGitHub() {
  githubLoading.value = true
  signIn.social({ provider: 'github', callbackURL: '/' })
}
</script>

<template>
  <div class="flex min-h-dvh bg-default">
    <div class="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
      <UColorModeButton class="absolute top-4 right-4" />

      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center mb-4">
            <UIcon :name="appConfig.app.icon" class="size-10 text-primary" />
          </div>
          <h1 class="text-2xl font-semibold text-highlighted">
            {{ mode === 'signin' ? 'Welcome back' : 'Create your account' }}
          </h1>
          <p class="mt-1.5 text-sm text-muted">
            {{ mode === 'signin' ? `Sign in to your ${appConfig.app.name} account.` : `Get started with ${appConfig.app.name}.` }}
          </p>
        </div>

        <UButton
          label="Continue with GitHub"
          icon="i-simple-icons-github"
          color="neutral"
          variant="outline"
          block
          size="lg"
          :loading="githubLoading"
          @click="onGitHub"
        />

        <USeparator label="or" class="my-6" />

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          icon="i-lucide-circle-alert"
          :close="{ color: 'error', variant: 'link' }"
          class="mb-4"
          @close="error = ''"
        />

        <UForm :schema :state class="space-y-4" @submit="onSubmit">
          <div class="name-field-wrapper" :class="mode === 'signup' ? 'expanded' : 'collapsed'">
            <div class="name-field-inner">
              <UFormField label="Name" name="name">
                <UInput
                  v-model="state.name"
                  placeholder="Your name"
                  size="lg"
                  class="w-full"
                  :tabindex="mode === 'signup' ? 0 : -1"
                />
              </UFormField>
            </div>
          </div>

          <UFormField label="Email" name="email">
            <UInput v-model="state.email" type="email" placeholder="you@example.com" size="lg" class="w-full" />
          </UFormField>

          <UFormField label="Password" name="password">
            <UInput v-model="state.password" type="password" placeholder="••••••••" size="lg" class="w-full" />
          </UFormField>

          <UButton
            type="submit"
            :label="mode === 'signin' ? 'Sign in' : 'Create account'"
            block
            size="lg"
            :loading
            class="text-white"
          />
        </UForm>

        <p class="mt-6 text-center text-sm text-muted">
          <template v-if="mode === 'signin'">
            Don't have an account?
            <button class="text-primary font-medium hover:underline cursor-pointer" @click="mode = 'signup'">
              Sign up
            </button>
          </template>
          <template v-else>
            Already have an account?
            <button class="text-primary font-medium hover:underline cursor-pointer" @click="mode = 'signin'">
              Sign in
            </button>
          </template>
        </p>

        <p class="mt-4 text-center text-xs text-muted/60">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>

    <div class="hidden lg:block w-1/2 m-2 rounded-lg border border-muted/50 relative overflow-hidden">
      <ClientOnly>
        <Shader class="absolute inset-0 size-full">
          <Glow :intensity="2.69" :size="27.5" :threshold="0.37">
            <Saturation :intensity="1.13">
              <Swirl
                :color-a="shaderColors.swirlA"
                :color-b="shaderColors.swirlB"
                :speed="0.8"
                :detail="1.2"
                :blend="50"
              />
            </Saturation>
            <ProgressiveBlur :angle="270" blend-mode="linearDodge" :center="{ x: 0.5, y: 0.5 }" :intensity="5">
              <DotGrid :color="shaderColors.dots" :density="190" :dot-size="0.22" :twinkle="1" />
            </ProgressiveBlur>
          </Glow>
        </Shader>
      </ClientOnly>
      <div class="absolute inset-0 rounded-lg shadow-[inset_0_4px_30px_rgba(0,0,0,0.5),inset_0_0_80px_rgba(0,0,0,0.35),inset_0_-2px_20px_rgba(0,0,0,0.25)] pointer-events-none" />
    </div>
  </div>
</template>

<style scoped>
/* CSS grid trick for smooth name field expand/collapse */
.name-field-wrapper {
  display: grid;
  transition: grid-template-rows 300ms ease, opacity 200ms ease;
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
</style>
