import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
// Supabase confirmation links may contain an implicit session. This UI uses
// Yggdrasil sessions, so discard those credentials before router initialization.
const confirmation = new URLSearchParams(location.hash.slice(1))
if (confirmation.has('access_token') || confirmation.has('error')) {
  history.replaceState(null, '', location.pathname)
  useAuthStore(pinia).notice = confirmation.has('error')
    ? 'El enlace de confirmación no es válido o ya caducó.'
    : 'Correo confirmado. Ya podés iniciar sesión.'
}
app.use(router)

app.mount('#app')
