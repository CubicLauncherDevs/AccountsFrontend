import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/account' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/AuthView.vue'),
      props: { mode: 'login' },
      meta: { guest: true, title: 'Entrar' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/AuthView.vue'),
      props: { mode: 'register' },
      meta: { guest: true, title: 'Crear cuenta' },
    },
    {
      path: '/account',
      component: () => import('@/views/AccountLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'account',
          component: () => import('@/views/AccountView.vue'),
          meta: { title: 'Mi cuenta' },
        },
        {
          path: 'skin',
          name: 'skin',
          component: () => import('@/views/SkinView.vue'),
          meta: { title: 'Mi skin' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: 'Página no encontrada' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.restore()
  if (to.hash === '#register' && !auth.session) return '/register'
  if (to.meta.requiresAuth && !auth.session) return { path: '/login', query: { next: to.path } }
  if (to.meta.guest && auth.session) return '/account'
})
router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Cuentas'} · CubicLauncher`
})

export default router
