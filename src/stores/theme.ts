import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'system' | 'light' | 'dark'
export const useThemeStore = defineStore('theme', () => {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const systemDark = ref(query.matches)
  const mode = ref<ThemeMode>('system')
  try {
    const stored = localStorage.getItem('theme-mode')
    if (stored === 'dark' || stored === 'light' || stored === 'system') mode.value = stored
  } catch {
    /* Use system settings. */
  }
  const resolved = computed(() =>
    mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
  )
  const change = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches
  }
  query.addEventListener('change', change)
  onScopeDispose(() => query.removeEventListener('change', change))
  watch(
    resolved,
    (theme) => {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(theme)
      document.documentElement.style.colorScheme = theme
    },
    { immediate: true },
  )
  function set(value: ThemeMode) {
    mode.value = value
    try {
      localStorage.setItem('theme-mode', value)
    } catch {
      /* Optional persistence. */
    }
  }
  return { mode, resolved, set }
})
