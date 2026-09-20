<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { PhEnvelopeSimple, PhArrowRight } from '@phosphor-icons/vue'
import { errorInfo, post } from '@/lib/api'
import NoticeMessage from '@/components/NoticeMessage.vue'
const props = withDefaults(defineProps<{ initialEmail?: string }>(), { initialEmail: '' })
const email = ref(props.initialEmail),
  busy = ref(false),
  sent = ref(false),
  remaining = ref(0)
const failure = ref({ message: '', diagnostic: '' })
watch(
  () => props.initialEmail,
  (value, previous) => {
    if (!email.value || email.value === previous) email.value = value
  },
)
let timer: ReturnType<typeof setInterval> | undefined
async function resend() {
  if (busy.value || remaining.value) return
  busy.value = true
  failure.value = { message: '', diagnostic: '' }
  try {
    await post('/account/resend-verification', { email: email.value.trim() })
    sent.value = true
    remaining.value = 60
    clearInterval(timer)
    timer = setInterval(() => {
      remaining.value--
      if (!remaining.value) clearInterval(timer)
    }, 1000)
  } catch (error) {
    failure.value = errorInfo(error)
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <form @submit.prevent="resend">
    <p class="muted verification-help">
      Te enviaremos un enlace si la cuenta todavía necesita confirmar su correo.
    </p>
    <NoticeMessage
      v-if="sent"
      kind="success"
      message="Solicitud recibida. Revisá tu bandeja de entrada y la carpeta de spam."
    />
    <NoticeMessage kind="error" v-bind="failure" />
    <label class="field verification-field" for="verification-email"
      >Correo de tu cuenta<input
        id="verification-email"
        v-model="email"
        type="email"
        autocomplete="email"
        required
        :disabled="busy"
        maxlength="254"
        placeholder="vos@ejemplo.com"
    /></label>
    <button class="button button-primary button-full" :disabled="busy || remaining > 0">
      <span v-if="busy" class="spinner" /><PhEnvelopeSimple v-else :size="16" />{{
        busy
          ? 'Enviando…'
          : remaining
            ? `Podés reenviar en ${remaining}s`
            : 'Enviar enlace de verificación'
      }}<PhArrowRight v-if="!busy && !remaining" :size="15" />
    </button>
  </form>
</template>
