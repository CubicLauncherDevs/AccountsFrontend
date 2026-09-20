<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  PhArrowCounterClockwise,
  PhArrowsClockwise,
  PhMinus,
  PhPlus,
  PhPause,
  PhPlay,
  PhStack,
  PhCube,
} from '@phosphor-icons/vue'
import type { Render } from 'skin3d'
import type { SkinModel } from '@/lib/api'
import { referenceSkin } from '@/lib/skins'

const props = withDefaults(
  defineProps<{ src: string | null; model: SkinModel; compact?: boolean }>(),
  { compact: false },
)
const canvas = ref<HTMLCanvasElement>(),
  container = ref<HTMLDivElement>()
const loading = ref(true),
  failure = ref(''),
  fallback = ref(''),
  active = ref(false)
const animation = ref<'none' | 'idle' | 'walk' | 'run'>('idle')
const paused = ref(false),
  rotate = ref(false),
  outerLayer = ref(true)
const showControls = computed(() => !props.compact)
let viewer: Render | undefined
let library: typeof import('skin3d') | undefined
let placeholder: HTMLCanvasElement
let resizeObserver: ResizeObserver | undefined
let intersection: IntersectionObserver | undefined
let media: MediaQueryList | undefined
let visible = true,
  alive = true,
  loadId = 0

function applyControls() {
  if (!viewer || !library) return
  const animations = {
    idle: library.IdleAnimation,
    walk: library.WalkingAnimation,
    run: library.RunningAnimation,
  }
  viewer.animation = animation.value === 'none' ? null : new animations[animation.value]()
  if (viewer.animation) viewer.animation.paused = paused.value
  viewer.autoRotate = rotate.value && !paused.value
  viewer.autoRotateSpeed = 0.35
  viewer.playerObject.skin.setOuterLayerVisible(outerLayer.value)
}
function visibility() {
  if (viewer) viewer.renderPaused = document.hidden || !visible
}
function motionPreference() {
  if (media?.matches) {
    animation.value = 'none'
    rotate.value = false
  }
}
async function loadTexture() {
  if (!viewer) return
  const current = ++loadId
  loading.value = true
  failure.value = ''
  try {
    await viewer.loadSkin(props.src ?? placeholder, { model: props.model })
    if (!alive || current !== loadId) return
    viewer.playerObject.skin.setOuterLayerVisible(outerLayer.value)
    active.value = true
  } catch {
    if (alive && current === loadId) {
      failure.value = 'No pudimos cargar esta textura en 3D. Podés seguir usando el editor.'
      active.value = false
    }
  } finally {
    if (alive && current === loadId) loading.value = false
  }
}

async function initViewer() {
  loading.value = true
  failure.value = ''
  try {
    library = await import('skin3d')
    if (!alive || !canvas.value || !container.value) return
    viewer = new library.Render({
      canvas: canvas.value,
      width: container.value.clientWidth,
      height: container.value.clientHeight,
      zoom: 0.77,
      fov: 40,
      maxPixelRatio: 1.5,
      enableFXAA: false,
      materialType: 'lambert',
    })
    viewer.playerObject.rotation.y = 0.35
    viewer.controls.enablePan = false
    viewer.globalLight.intensity = 1.1
    viewer.cameraLight.intensity = 0.65
    viewer.controls.saveState()
    applyControls()
    resizeObserver?.disconnect()
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && viewer && rect.width > 0 && rect.height > 0)
        viewer.setSize(rect.width, rect.height)
    })
    resizeObserver.observe(container.value)
    visibility()
    await loadTexture()
  } catch {
    viewer?.dispose()
    viewer = undefined
    if (alive) {
      loading.value = false
      active.value = false
      failure.value =
        'El visor 3D no está disponible en este navegador. Mostramos la textura en 2D.'
    }
  }
}

function zoom(delta: number) {
  if (viewer) viewer.zoom = Math.max(0.4, Math.min(1.1, viewer.zoom + delta))
}
function resetCamera() {
  if (!viewer) return
  viewer.resetModelRotation()
  viewer.controls.target.set(0, 0, 0)
  viewer.resetCameraPose()
  viewer.zoom = 0.77
  viewer.controls.update()
  viewer.playerObject.rotation.y = 0.35
  viewer.render()
}
function retry() {
  if (viewer) void loadTexture()
  else void initViewer()
}

watch([() => props.src, () => props.model], () => {
  void loadTexture()
})
watch([animation, paused, rotate, outerLayer], applyControls)
onMounted(() => {
  placeholder = referenceSkin()
  fallback.value = placeholder.toDataURL('image/png')
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference()
  media.addEventListener('change', motionPreference)
  document.addEventListener('visibilitychange', visibility)
  intersection = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true
    visibility()
  })
  if (container.value) intersection.observe(container.value)
  void initViewer()
})
onBeforeUnmount(() => {
  alive = false
  loadId++
  media?.removeEventListener('change', motionPreference)
  document.removeEventListener('visibilitychange', visibility)
  resizeObserver?.disconnect()
  intersection?.disconnect()
  viewer?.dispose()
})
</script>

<template>
  <div
    class="skin-viewer"
    :class="{ 'viewer-compact': compact }"
    :data-viewer-state="loading ? 'loading' : active ? 'ready' : 'fallback'"
  >
    <div class="viewer-label">
      <span><PhCube :size="13" /> {{ src ? 'VISTA PREVIA' : 'MODELO DE REFERENCIA' }}</span
      ><span>{{ model === 'slim' ? 'SLIM' : 'CLÁSICO' }}</span>
    </div>
    <div ref="container" class="viewer-stage">
      <div class="viewer-floor" aria-hidden="true" />
      <canvas
        ref="canvas"
        v-show="!failure"
        class="viewer-canvas"
        role="img"
        aria-label="Vista 3D del personaje. Usá los controles para girar y acercar."
      />
      <div v-if="loading" class="viewer-overlay" role="status">
        <span class="spinner" /> Preparando tu personaje…
      </div>
      <div v-else-if="failure" class="viewer-fallback">
        <img :src="src ?? fallback" alt="Textura de la skin en 2D" />
        <p>{{ failure }}</p>
        <button type="button" class="button button-small" @click="retry">
          Reintentar visor 3D
        </button>
      </div>
      <div v-if="active && !loading" class="viewer-quick-controls">
        <button
          type="button"
          class="icon-button"
          aria-label="Alejar personaje"
          title="Alejar"
          @click="zoom(-0.1)"
        >
          <PhMinus :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Acercar personaje"
          title="Acercar"
          @click="zoom(0.1)"
        >
          <PhPlus :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Girar personaje"
          title="Girar"
          @click="viewer && (viewer.playerObject.rotation.y += Math.PI / 4)"
        >
          <PhArrowsClockwise :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Restablecer cámara"
          title="Restablecer cámara"
          @click="resetCamera"
        >
          <PhArrowCounterClockwise :size="16" />
        </button>
      </div>
    </div>
    <p class="viewer-hint">Arrastrá para girar · Usá la rueda para acercar</p>
    <fieldset v-if="showControls" class="viewer-settings" :disabled="!active || loading">
      <div class="viewer-animation">
        <div class="animation-field">
          <label for="skin-animation">Animación</label
          ><select id="skin-animation" v-model="animation">
            <option value="none">Sin animación</option>
            <option value="idle">Reposo</option>
            <option value="walk">Caminar</option>
            <option value="run">Correr</option>
          </select>
        </div>
        <button
          type="button"
          class="button"
          :aria-pressed="paused"
          :aria-label="paused ? 'Reanudar animación' : 'Pausar animación'"
          @click="paused = !paused"
        >
          <PhPlay v-if="paused" :size="17" /><PhPause v-else :size="17" />
        </button>
      </div>
      <label class="checkbox-field"
        ><input v-model="rotate" type="checkbox" /><PhArrowsClockwise :size="15" /> Rotación
        automática</label
      >
      <label class="checkbox-field"
        ><input v-model="outerLayer" type="checkbox" /><PhStack :size="15" /> Mostrar segunda
        capa</label
      >
    </fieldset>
  </div>
</template>
