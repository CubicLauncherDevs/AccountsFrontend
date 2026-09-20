<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { watch } from 'vue'
import { PhUserCircle, PhTShirt } from '@phosphor-icons/vue'
import { useAuthStore } from '@/stores/auth'
import NoticeMessage from '@/components/NoticeMessage.vue'
const auth = useAuthStore(),
  router = useRouter()
watch(
  () => auth.session,
  (value) => {
    if (!value) void router.replace('/login')
  },
)
</script>

<template>
  <div class="container account-page">
    <div class="page-heading">
      <div>
        <span class="eyebrow">TU CUENTA CUBIC</span>
        <h1>Hola, {{ auth.profile?.name }}<span class="heading-dot">.</span></h1>
        <p class="muted">Tu perfil, tu apariencia y el próximo mundo por explorar.</p>
      </div>
      <span class="account-badge"><span class="status-dot" /> Sesión activa</span>
    </div>
    <nav class="account-tabs" aria-label="Secciones de tu cuenta">
      <RouterLink to="/account" exact-active-class="active"
        ><PhUserCircle :size="17" /> Mi cuenta</RouterLink
      ><RouterLink to="/account/skin" exact-active-class="active"
        ><PhTShirt :size="17" /> Apariencia</RouterLink
      >
    </nav>
    <NoticeMessage v-if="auth.notice" :message="auth.notice" />
    <RouterView />
  </div>
</template>
