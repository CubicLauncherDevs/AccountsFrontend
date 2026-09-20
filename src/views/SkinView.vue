<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  PhUploadSimple,
  PhFileImage,
  PhTrash,
  PhCheck,
  PhArrowCounterClockwise,
  PhInfo,
  PhPaintBrush,
} from '@phosphor-icons/vue'
import { useAuthStore } from '@/stores/auth'
import { errorInfo, type SkinModel } from '@/lib/api'
import { MAX_SKIN_BYTES, validateSkinFile } from '@/lib/skins'
import NoticeMessage from '@/components/NoticeMessage.vue'
import AnimatedModal from '@/components/AnimatedModal.vue'
import { vAnimateWidth } from '@/lib/motion'
const SkinViewer = defineAsyncComponent(() => import('@/components/SkinViewer.vue'))
const auth = useAuthStore()
const pendingFile = ref<File | null>(null),
  previewUrl = ref<string | null>(null)
const model = ref<SkinModel>(auth.skin?.model ?? 'default'),
  height = ref<number | null>(null)
const busy = ref(false),
  loading = ref(!auth.profileLoaded),
  dragging = ref(false),
  confirmDelete = ref(false)
const failure = ref({ message: '', diagnostic: '' }),
  success = ref(''),
  needsReload = ref(false)
let selection = 0,
  alive = true
const dirty = computed(
  () => !!pendingFile.value || (!!auth.skin && model.value !== auth.skin.model),
)
const preview = computed(() => previewUrl.value ?? auth.skin?.url ?? null)
watch(
  () => auth.skin,
  (skin) => {
    if (!pendingFile.value) model.value = skin?.model ?? 'default'
  },
)

function discard() {
  selection++
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  pendingFile.value = null
  height.value = null
  model.value = auth.skin?.model ?? 'default'
}

async function load() {
  loading.value = true
  failure.value = { message: '', diagnostic: '' }
  try {
    await auth.loadProfile()
    if (needsReload.value) {
      discard()
      needsReload.value = false
    }
  } catch (error) {
    failure.value = errorInfo(error)
  } finally {
    loading.value = false
  }
}

async function choose(file?: File) {
  if (!file || busy.value || loading.value || needsReload.value || !auth.profileLoaded) return
  const current = ++selection
  failure.value = { message: '', diagnostic: '' }
  success.value = ''
  try {
    const dimensions = await validateSkinFile(file)
    if (!alive || current !== selection) return
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(file)
    pendingFile.value = file
    height.value = dimensions.height
    if (height.value === 32) model.value = 'default'
    confirmDelete.value = false
  } catch (error) {
    if (alive && current === selection) failure.value = errorInfo(error)
  }
}
function chooseInput(event: Event) {
  const input = event.target as HTMLInputElement
  void choose(input.files?.[0])
  input.value = ''
}
function drop(event: DragEvent) {
  dragging.value = false
  void choose(event.dataTransfer?.files[0])
}

async function savedFile(): Promise<File> {
  if (pendingFile.value) return pendingFile.value
  if (!auth.skin) throw new Error('Elegí un archivo PNG primero.')
  const response = await fetch(auth.skin.url, {
    credentials: 'omit',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('No pudimos descargar tu skin actual para cambiar el modelo.')
  if (Number(response.headers.get('Content-Length')) > MAX_SKIN_BYTES)
    throw new Error('La textura supera el tamaño permitido.')
  return new File([await response.blob()], 'skin.png', { type: 'image/png' })
}
async function save() {
  if (busy.value || !dirty.value) return
  busy.value = true
  failure.value = { message: '', diagnostic: '' }
  success.value = ''
  try {
    const file = await savedFile()
    const size = await validateSkinFile(file)
    if (size.height === 32 && model.value === 'slim')
      throw new Error(
        'Las skins de 64 × 32 usan el modelo clásico. Elegí una de 64 × 64 para Slim.',
      )
    await auth.saveSkin(file, model.value)
    needsReload.value = true
    await auth.loadProfile()
    discard()
    needsReload.value = false
    success.value = 'Skin guardada. Volvé a entrar al mundo o servidor para verla en Minecraft.'
  } catch (error) {
    failure.value = errorInfo(error)
    if (needsReload.value)
      success.value =
        'La skin se guardó, pero no pudimos actualizar el perfil. Pulsá «Volver a cargar».'
  } finally {
    busy.value = false
  }
}
async function remove() {
  busy.value = true
  failure.value = { message: '', diagnostic: '' }
  success.value = ''
  try {
    await auth.deleteSkin()
    discard()
    confirmDelete.value = false
    success.value = 'Quitamos la skin de tu perfil.'
  } catch (error) {
    failure.value = errorInfo(error)
  } finally {
    busy.value = false
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value && !needsReload.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(
  () =>
    !auth.session ||
    !dirty.value ||
    needsReload.value ||
    window.confirm('Tenés cambios sin guardar. ¿Querés salir del editor?'),
)
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  if (!auth.profileLoaded) void load()
})
onBeforeUnmount(() => {
  alive = false
  discard()
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <div class="section-heading">
    <div>
      <h2>Hacelo tuyo.</h2>
      <p class="muted">Probá tu próxima skin antes de llevarla al juego.</p>
    </div>
    <span v-animate-width="180" class="badge resize-badge" :class="{ 'badge-pending': dirty }"
      ><span>{{
        needsReload ? 'Guardada · recargar perfil' : dirty ? 'Cambios sin guardar' : 'Sincronizado'
      }}</span></span
    >
  </div>
  <div class="skin-editor-grid">
    <div class="stack-lg">
      <NoticeMessage kind="error" v-bind="failure" />
      <NoticeMessage kind="success" :message="success" />
      <button
        v-if="failure.message && (!auth.profileLoaded || needsReload)"
        type="button"
        class="button"
        :disabled="busy || loading"
        @click="load"
      >
        Volver a cargar
      </button>
      <section class="panel">
        <div class="panel-heading">
          <PhPaintBrush :size="20" />
          <div>
            <h3>Textura de la skin</h3>
            <p>Una imagen, infinitas personalidades.</p>
          </div>
        </div>
        <fieldset :disabled="busy || loading || needsReload || !auth.profileLoaded">
          <label
            class="drop-zone"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="drop"
          >
            <input
              type="file"
              class="sr-only"
              accept="image/png"
              aria-label="Elegir archivo de skin"
              @change="chooseInput"
            />
            <span class="drop-icon"><PhUploadSimple :size="25" /></span
            ><strong>Arrastrá tu skin hasta acá</strong
            ><span>o <span class="underlined">elegí un archivo</span></span
            ><small>PNG · 64 × 64 o 64 × 32 · Hasta 128 KiB</small>
          </label>
          <div v-if="pendingFile" class="selected-file">
            <PhFileImage :size="20" />
            <div>
              <strong :title="pendingFile.name">{{ pendingFile.name }}</strong
              ><span
                >{{ (pendingFile.size / 1024).toFixed(1) }} KiB ·
                {{ height === 32 ? '64 × 32' : '64 × 64' }}</span
              >
            </div>
            <span class="badge">Local</span>
          </div>
          <div class="field model-field">
            <span id="model-label">Modelo del personaje</span>
            <div class="model-options" role="radiogroup" aria-labelledby="model-label">
              <label :class="{ selected: model === 'default' }"
                ><input v-model="model" type="radio" value="default" name="model" /><span
                  ><strong>Clásico</strong><small>Brazos de 4 píxeles</small></span
                ><PhCheck v-if="model === 'default'" :size="16"
              /></label>
              <label :class="{ selected: model === 'slim' }"
                ><input
                  v-model="model"
                  type="radio"
                  value="slim"
                  name="model"
                  :disabled="height === 32" /><span
                  ><strong>Slim</strong><small>Brazos de 3 píxeles</small></span
                ><PhCheck v-if="model === 'slim'" :size="16"
              /></label>
            </div>
          </div>
          <div class="editor-actions">
            <button type="button" class="button button-primary" :disabled="!dirty" @click="save">
              <span v-if="busy" class="spinner" /><PhCheck v-else :size="16" />{{
                busy ? 'Guardando…' : 'Guardar skin'
              }}</button
            ><button type="button" class="button" :disabled="!dirty" @click="discard">
              <PhArrowCounterClockwise :size="15" /> Descartar
            </button>
          </div>
        </fieldset>
      </section>
      <div class="subtle-note">
        <PhInfo :size="18" />
        <p>
          La vista previa es local hasta que guardás. Cambiar la animación o la segunda capa solo
          afecta al visor.
        </p>
      </div>
      <section v-if="auth.skin" class="panel remove-panel">
        <div>
          <h3>Volver a la apariencia predeterminada</h3>
          <p class="muted">Quitá la skin personalizada de tu perfil.</p>
        </div>
        <button
          class="button button-danger"
          :disabled="busy || loading"
          @click="confirmDelete = true"
        >
          <PhTrash :size="15" /> Quitar skin
        </button>
      </section>
    </div>
    <section class="panel editor-viewer-panel" aria-label="Vista previa de tu skin">
      <div v-if="loading" class="viewer-loading"><span class="spinner" /> Cargando perfil…</div>
      <SkinViewer v-else :src="preview" :model="model" />
      <div class="viewer-credit">
        Visor interactivo con
        <a href="https://skin3d.cosmicfi.dev" target="_blank" rel="noreferrer">skin3d</a>
      </div>
    </section>
  </div>
  <AnimatedModal v-model:open="confirmDelete" title="Quitar tu skin" :busy="busy">
    <p>
      Tu perfil volverá a usar la apariencia predeterminada. Podés subir otra skin cuando quieras.
    </p>
    <NoticeMessage v-if="failure.message" kind="error" v-bind="failure" />
    <template #footer
      ><button class="button" :disabled="busy" autofocus @click="confirmDelete = false">
        Cancelar</button
      ><button class="button button-danger" :disabled="busy" @click="remove">
        <span v-if="busy" class="spinner" /><PhTrash v-else :size="15" />{{
          busy ? 'Quitando…' : 'Sí, quitar skin'
        }}
      </button></template
    >
  </AnimatedModal>
</template>
