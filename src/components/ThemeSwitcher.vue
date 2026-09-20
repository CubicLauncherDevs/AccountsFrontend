<script setup lang="ts">
import { computed } from 'vue'
import { PhSun, PhMoon, PhMonitor } from '@phosphor-icons/vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
const theme = useThemeStore()
const icon = computed(() =>
  theme.mode === 'system' ? PhMonitor : theme.mode === 'dark' ? PhMoon : PhSun,
)
</script>

<template>
  <label class="theme-switch" title="Tema de la interfaz">
    <component :is="icon" :size="16" aria-hidden="true" />
    <select
      aria-label="Tema de la interfaz"
      :value="theme.mode"
      @change="theme.set(($event.target as HTMLSelectElement).value as ThemeMode)"
    >
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
    </select>
  </label>
</template>
