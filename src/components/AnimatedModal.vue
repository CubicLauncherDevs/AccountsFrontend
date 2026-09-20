<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { PhX } from '@phosphor-icons/vue'
import { motionDuration, RESIZE_EASING, vAnimateHeight } from '@/lib/motion'

const props = withDefaults(defineProps<{ open: boolean; title: string; busy?: boolean }>(), {
  busy: false,
})
const emit = defineEmits<{ 'update:open': [boolean] }>()
const dialog = ref<HTMLDialogElement>()
const titleId = useId(),
  descriptionId = useId()
let animation: Animation | undefined,
  revision = 0
let locked = false,
  previousOverflow = ''
let previousFocus: HTMLElement | null = null

function unlock() {
  if (locked) {
    document.body.style.overflow = previousOverflow
    locked = false
  }
}
function dismiss() {
  if (!props.busy) emit('update:open', false)
}
function backdrop(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dismiss()
}
async function syncOpen() {
  const node = dialog.value
  if (!node) return
  const current = ++revision
  animation?.cancel()
  if (props.open) {
    node.classList.remove('is-closing')
    if (!node.open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      locked = true
      node.showModal()
    }
    animation = node.animate(
      [
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: motionDuration(250), easing: RESIZE_EASING },
    )
  } else if (node.open) {
    node.classList.add('is-closing')
    animation = node.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(20px)' },
      ],
      { duration: motionDuration(250), easing: RESIZE_EASING, fill: 'forwards' },
    )
    await animation.finished.catch(() => {})
    if (current !== revision || props.open) return
    node.close()
    animation.cancel()
    unlock()
    const target =
      previousFocus?.isConnected &&
      previousFocus !== document.body &&
      !previousFocus.matches(':disabled')
        ? previousFocus
        : document.querySelector<HTMLElement>('#main-content')
    target?.focus({ preventScroll: true })
  }
}
watch(() => props.open, syncOpen, { flush: 'post' })
onMounted(syncOpen)
onBeforeUnmount(() => {
  revision++
  animation?.cancel()
  dialog.value?.close()
  unlock()
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      v-animate-height="300"
      class="animated-modal"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
      :aria-busy="busy"
      @cancel.prevent="dismiss"
      @click="backdrop"
    >
      <div class="modal-content">
        <div class="modal-heading">
          <h2 :id="titleId">{{ title }}</h2>
          <button
            type="button"
            class="icon-button"
            :disabled="busy"
            aria-label="Cerrar diálogo"
            @click="dismiss"
          >
            <PhX :size="18" />
          </button>
        </div>
        <div :id="descriptionId" class="modal-description"><slot /></div>
        <div class="modal-footer"><slot name="footer" /></div>
      </div>
    </dialog>
  </Teleport>
</template>
