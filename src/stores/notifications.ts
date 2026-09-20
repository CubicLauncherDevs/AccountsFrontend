import { onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'

export const useNotificationsStore = defineStore('notifications', () => {
  const connectionMessage = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  function showConnectionError(message: string) {
    clearTimeout(timer)
    connectionMessage.value = message
    timer = setTimeout(() => {
      connectionMessage.value = ''
    }, 7000)
  }
  onScopeDispose(() => clearTimeout(timer))
  return { connectionMessage, showConnectionError }
})
