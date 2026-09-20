<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  PhUserCircle,
  PhEnvelopeSimple,
  PhShieldCheck,
  PhClockCounterClockwise,
  PhPencilSimple,
  PhLockKey,
  PhArrowRight,
} from '@phosphor-icons/vue'
import { errorInfo } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import CopyButton from '@/components/CopyButton.vue'
import NoticeMessage from '@/components/NoticeMessage.vue'
import AnimatedModal from '@/components/AnimatedModal.vue'

const auth = useAuthStore()
const loading = ref(false),
  busy = ref(false),
  success = ref('')
const failure = ref({ message: '', diagnostic: '' }),
  editError = ref({ message: '', diagnostic: '' })
const editing = ref<'username' | 'email' | 'password' | null>(null),
  editOpen = ref(false)
const nextValue = ref(''),
  password = ref(''),
  confirmPassword = ref('')
const modalTitle = computed(
  () =>
    ({
      username: 'Cambiar nombre de Minecraft',
      email: 'Cambiar correo electrónico',
      password: 'Cambiar contraseña',
    })[editing.value ?? 'username'],
)
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))

async function load() {
  loading.value = true
  failure.value = { message: '', diagnostic: '' }
  try {
    await auth.loadAccount()
  } catch (error) {
    failure.value = errorInfo(error)
  } finally {
    loading.value = false
  }
}
function edit(kind: 'username' | 'email' | 'password') {
  editing.value = kind
  nextValue.value =
    kind === 'username'
      ? (auth.profile?.name ?? '')
      : kind === 'email'
        ? (auth.account?.email ?? '')
        : ''
  password.value = confirmPassword.value = ''
  editError.value = { message: '', diagnostic: '' }
  editOpen.value = true
}
watch(editOpen, (open) => {
  if (!open) password.value = confirmPassword.value = ''
})
async function save() {
  if (busy.value || !editing.value) return
  if (editing.value === 'password' && nextValue.value !== confirmPassword.value) {
    editError.value = { message: 'Las contraseñas nuevas no coinciden.', diagnostic: '' }
    return
  }
  if (editing.value === 'password' && nextValue.value === password.value) {
    editError.value = { message: 'Elegí una contraseña distinta de la actual.', diagnostic: '' }
    return
  }
  busy.value = true
  editError.value = { message: '', diagnostic: '' }
  success.value = ''
  try {
    if (editing.value === 'username') {
      await auth.changeUsername(nextValue.value.trim(), password.value)
      success.value =
        'Nombre actualizado. Conservás el mismo UUID; el launcher debe renovar la sesión para obtener el nuevo nombre.'
    } else if (editing.value === 'email') {
      await auth.changeEmail(nextValue.value.trim(), password.value)
      success.value =
        'Cambio de correo solicitado. Revisá el correo nuevo y, si se solicita, el actual para confirmar el cambio.'
    } else {
      await auth.changePassword(password.value, nextValue.value)
      success.value =
        'Contraseña actualizada. Las sesiones anteriores se cerraron y esta pestaña usa una sesión nueva.'
    }
    password.value = confirmPassword.value = ''
    nextValue.value = ''
    editOpen.value = false
    await load()
  } catch (error) {
    editError.value = errorInfo(error)
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="account-notices">
    <NoticeMessage kind="error" v-bind="failure" /><NoticeMessage
      kind="success"
      :message="success"
    /><button v-if="failure.message" class="button" :disabled="loading" @click="load">
      Volver a cargar cuenta
    </button>
  </div>
  <div class="settings-grid">
    <section class="panel identity-panel">
      <div class="panel-heading">
        <PhUserCircle :size="22" />
        <div>
          <h2>Tu perfil</h2>
          <p>Tu identidad de Minecraft, en un solo lugar.</p>
        </div>
      </div>
      <div class="identity-name">
        <span class="profile-initial">{{ auth.profile?.name.slice(0, 1).toUpperCase() }}</span>
        <div>
          <strong>{{ auth.profile?.name }}</strong
          ><span>Cuenta de CubicLauncher</span>
        </div>
        <button
          class="button button-small"
          :disabled="loading || !auth.account"
          @click="edit('username')"
        >
          <PhPencilSimple :size="14" /> Cambiar nombre
        </button>
      </div>
      <dl class="profile-data">
        <div>
          <dt>UUID permanente</dt>
          <dd class="copy-row">
            <code>{{ auth.profile?.id }}</code
            ><CopyButton :value="auth.profile?.id ?? ''" label="Copiar UUID" />
          </dd>
        </div>
        <div>
          <dt>Correo electrónico</dt>
          <dd class="email-detail">
            <span>{{ auth.account?.email ?? (loading ? 'Cargando…' : '—') }}</span>
          </dd>
        </div>
        <div v-if="auth.account?.createdAt">
          <dt>Cuenta creada</dt>
          <dd>{{ formatDate(auth.account.createdAt) }}</dd>
        </div>
      </dl>
      <div class="profile-skin-link">
        <div>
          <strong>Tu skin, tu estilo.</strong>
          <p>Probá y guardá tu apariencia en el editor 3D.</p>
        </div>
        <RouterLink to="/account/skin" class="button"
          >Personalizar <PhArrowRight :size="14"
        /></RouterLink>
      </div>
    </section>
    <section class="panel security-panel">
      <div class="panel-heading">
        <PhShieldCheck :size="22" />
        <div>
          <h2>Acceso y seguridad</h2>
          <p>Administrá cómo entrás a tu cuenta.</p>
        </div>
      </div>
      <div class="security-row">
        <PhEnvelopeSimple :size="20" />
        <div>
          <h3>Correo electrónico</h3>
          <p>Los cambios pueden requerir confirmación en tu correo actual y en el nuevo.</p>
        </div>
        <button
          class="button button-small"
          :disabled="loading || !auth.account"
          @click="edit('email')"
        >
          Cambiar correo
        </button>
      </div>
      <NoticeMessage
        v-if="auth.account?.pendingEmail"
        :message="`Pendiente de confirmar: ${auth.account.pendingEmail}. El cambio todavía no se completó.`"
      />
      <div class="security-row">
        <PhLockKey :size="20" />
        <div>
          <h3>Contraseña</h3>
          <p>Al cambiarla, se revocan las sesiones anteriores.</p>
        </div>
        <button
          class="button button-small"
          :disabled="loading || !auth.account"
          @click="edit('password')"
        >
          Cambiar contraseña
        </button>
      </div>
    </section>
    <section class="panel history-panel">
      <div class="panel-heading">
        <PhClockCounterClockwise :size="22" />
        <div>
          <h2>Historial de nombres</h2>
          <p>Los cambios quedan vinculados a tu UUID, que siempre es el mismo.</p>
        </div>
        <span v-if="auth.account" class="badge"
          >{{ auth.account.historyTotal }}
          {{ auth.account.historyTotal === 1 ? 'cambio' : 'cambios' }}</span
        >
      </div>
      <p v-if="!auth.account?.nameHistory.length" class="history-empty">
        {{ loading ? 'Cargando historial…' : 'Todavía no hay cambios de nombre registrados.' }}
      </p>
      <ul v-else class="name-history">
        <li
          v-for="item in auth.account.nameHistory"
          :key="`${item.changedAt}:${item.previousName}`"
        >
          <div>
            <span class="previous-name">{{ item.previousName }}</span
            ><PhArrowRight :size="14" /><strong>{{ item.newName }}</strong>
          </div>
          <time :datetime="item.changedAt">{{ formatDate(item.changedAt) }}</time>
        </li>
      </ul>
      <p v-if="auth.account && auth.account.historyTotal > 20" class="field-hint">
        Mostrando los últimos 20 cambios. El historial completo permanece guardado.
      </p>
    </section>
  </div>
  <AnimatedModal v-model:open="editOpen" :title="modalTitle" :busy="busy">
    <form id="account-edit" class="account-edit-form" @submit.prevent="save">
      <NoticeMessage kind="error" v-bind="editError" />
      <p v-if="editing === 'username'" class="muted">
        El UUID se mantiene. El nombre anterior quedará en tu historial.
      </p>
      <p v-if="editing === 'email'" class="muted">
        Supabase enviará los enlaces de confirmación según la configuración del servicio.
      </p>
      <div class="field">
        <label for="account-new-value">{{
          editing === 'username'
            ? 'Nuevo nombre de Minecraft'
            : editing === 'email'
              ? 'Nuevo correo'
              : 'Nueva contraseña'
        }}</label
        ><input
          id="account-new-value"
          v-model="nextValue"
          :type="editing === 'email' ? 'email' : editing === 'password' ? 'password' : 'text'"
          :pattern="editing === 'username' ? '[A-Za-z0-9_]{3,16}' : undefined"
          :minlength="editing === 'password' ? 10 : undefined"
          :maxlength="editing === 'username' ? 16 : editing === 'email' ? 254 : 1024"
          :autocomplete="
            editing === 'password' ? 'new-password' : editing === 'email' ? 'email' : 'username'
          "
          :disabled="busy"
          required
        /><span v-if="editing === 'username'" class="field-hint"
          >3–16 letras, números o guiones bajos.</span
        >
      </div>
      <label v-if="editing === 'password'" class="field" for="account-confirm-password"
        >Confirmar nueva contraseña<input
          id="account-confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          :disabled="busy"
          maxlength="1024"
          required
      /></label>
      <label class="field" for="account-current-password"
        >Contraseña actual<input
          id="account-current-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          :disabled="busy"
          maxlength="1024"
          required
      /></label>
    </form>
    <template #footer
      ><button class="button" :disabled="busy" @click="editOpen = false">Cancelar</button
      ><button form="account-edit" type="submit" class="button button-primary" :disabled="busy">
        <span v-if="busy" class="spinner" />{{ busy ? 'Guardando…' : 'Guardar cambio' }}
      </button></template
    >
  </AnimatedModal>
</template>
