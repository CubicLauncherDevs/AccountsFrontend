<script setup lang="ts">
import { PhInfo, PhWarningCircle, PhCheckCircle } from '@phosphor-icons/vue'
withDefaults(
  defineProps<{ message: string; kind?: 'error' | 'success' | 'info'; diagnostic?: string }>(),
  { kind: 'info', diagnostic: '' },
)
</script>

<template>
  <div
    v-if="message"
    class="notice"
    :class="`notice-${kind}`"
    :role="kind === 'error' ? 'alert' : 'status'"
  >
    <PhWarningCircle v-if="kind === 'error'" :size="18" aria-hidden="true" />
    <PhCheckCircle v-else-if="kind === 'success'" :size="18" aria-hidden="true" />
    <PhInfo v-else :size="18" aria-hidden="true" />
    <div>
      <p>{{ message }}</p>
      <details v-if="diagnostic">
        <summary>Detalles técnicos</summary>
        <p class="technical-details">{{ diagnostic }}</p>
      </details>
    </div>
  </div>
</template>
