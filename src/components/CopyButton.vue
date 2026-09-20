<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { PhCopy, PhCheck } from '@phosphor-icons/vue'
const props = defineProps<{ value: string; label: string }>()
const copied = ref(false),
  failed = ref(false)
let timer: ReturnType<typeof setTimeout>
async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    failed.value = false
  } catch {
    failed.value = true
  }
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    failed.value = false
  }, 2500)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button
    class="icon-button"
    type="button"
    :aria-label="copied ? 'Copiado' : label"
    :title="failed ? 'Seleccioná el texto para copiarlo' : copied ? 'Copiado' : label"
    @click="copy"
  >
    <PhCheck v-if="copied" :size="16" /><PhCopy v-else :size="16" />
    <span class="sr-only" aria-live="polite">{{
      failed
        ? 'No se pudo copiar. Seleccioná y copiá el texto.'
        : copied
          ? 'Copiado al portapapeles'
          : ''
    }}</span>
  </button>
</template>
