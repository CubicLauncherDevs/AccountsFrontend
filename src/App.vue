<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { PhArrowUpRight, PhSignOut, PhGithubLogo } from '@phosphor-icons/vue'
import CubicLogo from '@/components/CubicLogo.vue'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
const auth = useAuthStore(),
  router = useRouter()
const notifications = useNotificationsStore()
const signingOut = ref(false)
async function logout() {
  signingOut.value = true
  try {
    await auth.logout()
    await router.push('/login')
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <Teleport to="body"
    ><Transition name="corner-notice"
      ><p v-if="notifications.connectionMessage" class="connection-notice" role="alert">
        {{ notifications.connectionMessage }}
      </p></Transition
    ></Teleport
  >
  <a class="skip-link" href="#main-content">Ir al contenido</a>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" aria-label="CubicLauncher · Cuentas"
        ><CubicLogo /><span>CubicLauncher</span><span class="brand-divider" /><span
          class="brand-section"
          >Cuentas</span
        ></RouterLink
      >
      <div class="header-actions">
        <ThemeSwitcher />
        <a class="site-link" href="https://cubiclauncher.org"
          >Sitio web <PhArrowUpRight :size="13"
        /></a>
        <button
          v-if="auth.session"
          class="button button-small"
          :disabled="signingOut"
          @click="logout"
        >
          <PhSignOut :size="15" />{{ signingOut ? 'Saliendo…' : 'Salir' }}
        </button>
      </div>
    </div>
  </header>
  <main id="main-content" class="main-content" tabindex="-1"><RouterView /></main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <a class="brand footer-brand" href="https://cubiclauncher.org"
        ><CubicLogo /><span>CubicLauncher</span></a
      >
      <nav aria-label="Enlaces del sitio">
        <a href="https://dev.cubiclauncher.org/docs">Documentación</a>
        <a href="https://dev.cubiclauncher.org/docs/es-ES/Legal/privacy">Privacidad</a>
        <a href="https://dev.cubiclauncher.org/docs/es-ES/Legal/terms">Términos</a>
        <a href="https://github.com/CubicLauncherDevs" aria-label="CubicLauncher en GitHub"
          ><PhGithubLogo :size="17"
        /></a>
      </nav>
      <span class="footer-copyright">© {{ new Date().getFullYear() }} CubicLauncher</span>
    </div>
  </footer>
</template>
