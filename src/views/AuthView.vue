<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  PhArrowRight,
  PhEye,
  PhEyeSlash,
  PhShieldCheck,
  PhPaintBrush,
  PhFingerprint,
} from '@phosphor-icons/vue'
import CubicLogo from '@/components/CubicLogo.vue'
import NoticeMessage from '@/components/NoticeMessage.vue'
import AnimatedModal from '@/components/AnimatedModal.vue'
import EmailVerificationForm from '@/components/EmailVerificationForm.vue'
import { ApiError, errorInfo, post, request, type ServerMetadata } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { vAnimateHeight } from '@/lib/motion'

const props = defineProps<{ mode: 'login' | 'register' }>()
const auth = useAuthStore(),
  route = useRoute(),
  router = useRouter()
const registering = computed(() => props.mode === 'register')
const username = ref(''),
  email = ref(''),
  password = ref(''),
  confirmation = ref('')
const visible = ref(false),
  busy = ref(false),
  registered = ref(false),
  emailRequired = ref(true)
const registrationEnabled = ref(true)
const failure = ref({ message: '', diagnostic: '' })
const accessError = ref('')
const verificationOpen = ref(false)

watch(
  () => props.mode,
  async () => {
    password.value = confirmation.value = ''
    registered.value = false
    failure.value = { message: '', diagnostic: '' }
    accessError.value = ''
    visible.value = false
    if (registering.value) {
      try {
        registrationEnabled.value =
          (await request<ServerMetadata>('/')).meta.registrationEnabled !== false
      } catch (error) {
        failure.value = errorInfo(error)
      }
    }
  },
  { immediate: true },
)

watch(username, () => {
  if (accessError.value) {
    accessError.value = ''
    failure.value = { message: '', diagnostic: '' }
  }
})

async function submit() {
  if (busy.value) return
  if (registering.value && password.value !== confirmation.value) {
    failure.value = { message: 'Las contraseñas no coinciden.', diagnostic: '' }
    return
  }
  busy.value = true
  failure.value = { message: '', diagnostic: '' }
  accessError.value = ''
  const submittedMode = props.mode
  try {
    if (registering.value) {
      const result = await post<{ emailConfirmationRequired?: boolean }>('/account/register', {
        username: username.value.trim(),
        email: email.value.trim(),
        password: password.value,
      })
      emailRequired.value = result.emailConfirmationRequired !== false
      registered.value = true
    } else {
      await auth.login(username.value, password.value)
      const next = route.query.next
      await router.replace(
        typeof next === 'string' && ['/account', '/account/skin'].includes(next)
          ? next
          : '/account',
      )
    }
    password.value = confirmation.value = ''
  } catch (error) {
    if (props.mode === submittedMode) {
      failure.value = errorInfo(error)
      accessError.value = error instanceof ApiError ? error.code : ''
    }
  } finally {
    busy.value = false
  }
}

async function retrySession() {
  busy.value = true
  try {
    await auth.restore(true)
    if (auth.session) await router.replace('/account')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container auth-page">
    <div v-animate-height="300" class="auth-frame">
      <div class="auth-frame-inner">
        <section class="auth-showcase" aria-label="CubicLauncher Accounts">
          <div class="showcase-content">
            <span class="eyebrow light-eyebrow">CUBICLAUNCHER ACCOUNTS</span>
            <CubicLogo class="showcase-logo" />
            <h2>
              Tu perfil de Minecraft,<br />
              a tu manera.
            </h2>
            <p>Personalizá tu skin, administrá tus datos y seguí los cambios de tu cuenta.</p>
            <div class="showcase-features">
              <span><PhFingerprint :size="18" /> Tu nombre y su historial</span>
              <span><PhPaintBrush :size="18" /> Skins con vista previa en 3D</span>
              <span><PhShieldCheck :size="18" /> Correo y acceso bajo control</span>
            </div>
          </div>
          <span class="showcase-caption">CubicLauncher · Gestión de cuentas</span>
        </section>
        <section class="auth-form-panel">
          <nav class="auth-tabs" aria-label="Acceso a tu cuenta">
            <RouterLink to="/login">Entrar</RouterLink
            ><RouterLink to="/register">Crear cuenta</RouterLink>
          </nav>
          <div
            class="auth-slide-viewport"
            :data-slide-direction="registering ? 'forward' : 'backward'"
          >
            <Transition
              :name="registering ? 'auth-slide-forward' : 'auth-slide-backward'"
              mode="out-in"
            >
              <div :key="`${mode}:${registered}`" class="auth-slide-content">
                <template v-if="registered">
                  <span class="eyebrow">YA CASI ESTÁS</span>
                  <h1>{{ emailRequired ? 'Revisá tu correo' : 'Tu cuenta está lista' }}</h1>
                  <p class="muted auth-description">
                    {{
                      emailRequired
                        ? 'Recibimos tu registro. Si tu cuenta necesita confirmación, encontrarás el enlace en tu bandeja de entrada.'
                        : 'Ya podés entrar con tu correo o nombre de Minecraft y personalizar tu perfil.'
                    }}
                  </p>
                  <RouterLink class="button button-primary button-full" to="/login"
                    >Ir a iniciar sesión <PhArrowRight :size="16"
                  /></RouterLink>
                  <button
                    v-if="emailRequired"
                    type="button"
                    class="text-link verification-link"
                    @click="verificationOpen = true"
                  >
                    Reenviar correo de verificación
                  </button>
                </template>
                <template v-else>
                  <span class="eyebrow">{{
                    registering ? 'TU HISTORIA EMPIEZA ACÁ' : 'TU ESPACIO EN CUBIC'
                  }}</span>
                  <h1>{{ registering ? 'Creá tu cuenta' : 'Qué bueno verte de nuevo' }}</h1>
                  <p class="muted auth-description">
                    {{
                      registering
                        ? 'Elegí tu nombre y hacelo tuyo.'
                        : 'Entrá para administrar tu perfil y tu skin.'
                    }}
                  </p>
                  <NoticeMessage v-if="auth.notice && !registering" :message="auth.notice" />
                  <div v-if="auth.restoreError && !registering" class="stack-sm">
                    <NoticeMessage kind="error" v-bind="errorInfo(auth.restoreError)" />
                    <button class="button" :disabled="busy" @click="retrySession">
                      Reintentar sesión guardada
                    </button>
                  </div>
                  <NoticeMessage kind="error" v-bind="failure" />
                  <button
                    v-if="!registering && accessError === 'EmailNotConfirmed'"
                    type="button"
                    class="button button-full access-help"
                    @click="verificationOpen = true"
                  >
                    Reenviar correo de verificación <PhArrowRight :size="15" />
                  </button>
                  <a
                    v-if="!registering && accessError === 'AccountBanned'"
                    class="button button-full access-help"
                    href="https://discord.com/invite/7VaqSrPukm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contactar al equipo de CubicLauncher <PhArrowRight :size="15" />
                  </a>
                  <NoticeMessage
                    v-if="registering && !registrationEnabled"
                    message="Los registros están cerrados por el momento."
                  />
                  <form @submit.prevent="submit" :aria-busy="busy">
                    <fieldset :disabled="busy || (registering && !registrationEnabled)">
                      <label v-if="registering" class="field" for="email"
                        >Correo electrónico<input
                          id="email"
                          v-model="email"
                          type="email"
                          autocomplete="email"
                          placeholder="vos@ejemplo.com"
                          maxlength="254"
                          required
                      /></label>
                      <div class="field">
                        <label for="username">{{
                          registering ? 'Nombre de Minecraft' : 'Correo o nombre de Minecraft'
                        }}</label>
                        <input
                          id="username"
                          v-model="username"
                          autocomplete="username"
                          :placeholder="registering ? 'TuNombre' : 'TuNombre o correo'"
                          :pattern="registering ? '[A-Za-z0-9_]{3,16}' : undefined"
                          :maxlength="registering ? 16 : 254"
                          :aria-describedby="registering ? 'username-hint' : undefined"
                          required
                        />
                        <span v-if="registering" id="username-hint" class="field-hint"
                          >3–16 letras, números o guiones bajos.</span
                        >
                      </div>
                      <div class="field">
                        <label for="password">Contraseña</label>
                        <div class="password-group">
                          <div class="password-input">
                            <input
                              id="password"
                              v-model="password"
                              :type="visible ? 'text' : 'password'"
                              :autocomplete="registering ? 'new-password' : 'current-password'"
                              :minlength="registering ? 10 : undefined"
                              :aria-describedby="registering ? 'password-hint' : undefined"
                              maxlength="1024"
                              placeholder="Tu contraseña"
                              required
                            />
                            <button
                              type="button"
                              class="icon-button"
                              :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                              :aria-pressed="visible"
                              @click="visible = !visible"
                            >
                              <PhEyeSlash v-if="visible" :size="17" /><PhEye v-else :size="17" />
                            </button>
                          </div>
                          <div v-if="registering" class="password-confirm">
                            <label class="sr-only" for="confirm-password"
                              >Confirmar contraseña</label
                            >
                            <input
                              id="confirm-password"
                              v-model="confirmation"
                              :type="visible ? 'text' : 'password'"
                              autocomplete="new-password"
                              placeholder="Confirmar contraseña"
                              maxlength="1024"
                              required
                            />
                          </div>
                        </div>
                        <span v-if="registering" id="password-hint" class="field-hint"
                          >Al menos 10 caracteres. Repetila para confirmar.</span
                        >
                      </div>
                      <button class="button button-primary button-full submit-button" type="submit">
                        <span v-if="busy" class="spinner" />{{
                          busy ? 'Un momento…' : registering ? 'Crear mi cuenta' : 'Iniciar sesión'
                        }}<PhArrowRight v-if="!busy" :size="16" />
                      </button>
                    </fieldset>
                  </form>
                  <button
                    v-if="
                      !registering &&
                      accessError !== 'EmailNotConfirmed' &&
                      accessError !== 'AccountBanned'
                    "
                    type="button"
                    class="text-link verification-link"
                    @click="verificationOpen = true"
                  >
                    Necesito verificar mi correo
                  </button>
                  <p class="auth-footnote">
                    {{
                      registering
                        ? 'Al crear tu cuenta, aceptás los'
                        : 'Tu sesión se conserva solo en esta pestaña.'
                    }}
                    <a
                      v-if="registering"
                      href="https://dev.cubiclauncher.org/docs/es-ES/Legal/terms"
                      >términos de uso.</a
                    >
                  </p>
                </template>
              </div>
            </Transition>
          </div>
        </section>
      </div>
    </div>
  </div>
  <AnimatedModal v-model:open="verificationOpen" title="Verificar correo"
    ><EmailVerificationForm :initial-email="email || (username.includes('@') ? username : '')"
  /></AnimatedModal>
</template>
