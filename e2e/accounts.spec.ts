import { test, expect } from '@playwright/test'
import { login, mockApi, png } from './fixtures'

test('explains a suspended account and offers support without creating a session', async ({
  page,
}) => {
  await mockApi(page, { loginError: 'banned' })
  await page.goto('/login')
  await page.getByLabel('Correo o nombre de Minecraft').fill('TestPlayer')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Tu cuenta está suspendida')
  await expect(
    page.getByRole('link', { name: 'Contactar al equipo de CubicLauncher' }),
  ).toHaveAttribute('href', 'https://discord.com/invite/7VaqSrPukm')
  await expect(page.getByRole('button', { name: 'Necesito verificar mi correo' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('cubic-account-session-v1'))).toBeNull()
  await page.getByLabel('Correo o nombre de Minecraft').fill('AnotherPlayer')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Contactar al equipo de CubicLauncher' }),
  ).toHaveCount(0)
})

test('offers a prefilled verification resend when the email is not confirmed', async ({ page }) => {
  const api = await mockApi(page, { loginError: 'unconfirmed' })
  await page.goto('/login')
  await page.getByLabel('Correo o nombre de Minecraft').fill('test@example.com')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Confirmá tu correo para entrar')
  await page.getByRole('button', { name: 'Reenviar correo de verificación', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Verificar correo' })
  await expect(modal.getByLabel('Correo de tu cuenta', { exact: true })).toHaveValue(
    'test@example.com',
  )
  await modal.getByRole('button', { name: 'Enviar enlace de verificación', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('Solicitud recibida')
  expect(api.verifications).toBe(1)
  expect(await page.evaluate(() => sessionStorage.getItem('cubic-account-session-v1'))).toBeNull()
  await expect(page).toHaveURL(/\/login$/)
})

test('manages account details, preserves UUID and displays previous names', async ({
  page,
}, info) => {
  const api = await mockApi(page)
  await login(page)
  await expect(page.getByText('test@example.com', { exact: true })).toBeVisible()
  await expect(page.getByText('Proveedor', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cambiar nombre', exact: true }).click()
  let modal = page.getByRole('dialog', { name: 'Cambiar nombre de Minecraft' })
  await modal.getByLabel('Nuevo nombre de Minecraft', { exact: true }).fill('NewPlayer')
  await modal.getByLabel('Contraseña actual', { exact: true }).fill('incorrect-password')
  await modal.getByRole('button', { name: 'Guardar cambio', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('La contraseña actual no es correcta')
  await modal.getByLabel('Contraseña actual', { exact: true }).fill('test-password-only')
  await modal.getByRole('button', { name: 'Guardar cambio', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Hola, NewPlayer.' })).toBeVisible()
  await expect(page.locator('.name-history')).toContainText('TestPlayer')
  await expect(page.locator('.name-history')).toContainText('NewPlayer')
  await expect(page.locator('.profile-data code')).toHaveText('b'.repeat(32))
  await page.getByRole('button', { name: 'Cambiar correo', exact: true }).click()
  modal = page.getByRole('dialog', { name: 'Cambiar correo electrónico' })
  await modal.getByLabel('Nuevo correo', { exact: true }).fill('new@example.com')
  await modal.getByLabel('Contraseña actual', { exact: true }).fill('test-password-only')
  await modal.getByRole('button', { name: 'Guardar cambio', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(
    page.getByText('Pendiente de confirmar: new@example.com.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click()
  modal = page.getByRole('dialog', { name: 'Cambiar contraseña', exact: true })
  await modal.getByLabel('Nueva contraseña', { exact: true }).fill('new-password-only')
  await modal.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('new-password-only')
  await modal.getByLabel('Contraseña actual', { exact: true }).fill('test-password-only')
  await modal.getByRole('button', { name: 'Guardar cambio', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Contraseña actualizada' })).toBeVisible()
  expect(api.passwordChanges).toBe(1)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('account-settings.png'), fullPage: true })
})

test('can resend email verification before signing in', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Necesito verificar mi correo' }).click()
  const modal = page.getByRole('dialog', { name: 'Verificar correo' })
  await modal.getByLabel('Correo de tu cuenta', { exact: true }).fill('test@example.com')
  await modal.getByRole('button', { name: 'Enviar enlace de verificación', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('Solicitud recibida')
  expect(api.verifications).toBe(1)
})

test('slides between login and register while keeping only the active form interactive', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/login')
  await page.getByLabel('Contraseña', { exact: true }).fill('unsaved-password')
  await page.getByRole('link', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Creá tu cuenta' })).toBeVisible()
  await expect(page.locator('.auth-slide-viewport')).toHaveAttribute(
    'data-slide-direction',
    'forward',
  )
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Confirmar contraseña')).toBeVisible()
  await page.getByRole('link', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Qué bueno verte de nuevo' })).toBeVisible()
  await expect(page.locator('.auth-slide-viewport')).toHaveAttribute(
    'data-slide-direction',
    'backward',
  )
  await expect(page.getByLabel('Confirmar contraseña')).toHaveCount(0)
})

test('shows connection failures as plain text in the top corner, without an inline box', async ({
  page,
}) => {
  await page.route('https://auth.cubiclauncher.org/**', (route) => route.abort('failed'))
  await page.goto('/login')
  await page.getByLabel('Correo o nombre de Minecraft').fill('TestPlayer')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  const message = page.getByRole('alert')
  await expect(message).toHaveText('No se pudo conectar con CubAuth.')
  await expect(message).toHaveClass('connection-notice')
  await expect(page.locator('.auth-form-panel .notice-error')).toHaveCount(0)
  await expect(message).toHaveCSS('position', 'fixed')
  await expect(message).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})

test('redirects protected routes, changes theme and shows login errors', async ({ page }, info) => {
  await mockApi(page, { loginError: true })
  await page.goto('/account/skin')
  await expect(page).toHaveURL(/\/login\?next=/)
  await page.getByLabel('Tema de la interfaz').selectOption('dark')
  await expect(page.locator('html')).toHaveClass('dark')
  await page.getByLabel('Correo o nombre de Minecraft').fill('TestPlayer')
  await page.getByLabel('Contraseña', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Usuario o contraseña incorrectos')
  await page.screenshot({ path: info.outputPath('login-dark.png'), fullPage: true })
  await page.getByLabel('Tema de la interfaz').selectOption('light')
  await page.reload()
  await expect(page.locator('html')).toHaveClass('light')
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  )
})

test('registers with validation and handles disabled email confirmation', async ({
  page,
}, info) => {
  const api = await mockApi(page)
  await page.goto('/register')
  await page.getByLabel('Correo electrónico').fill('test@example.com')
  await page.getByLabel('Nombre de Minecraft', { exact: true }).fill('NewPlayer')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-only')
  await page.getByLabel('Confirmar contraseña').fill('another-password')
  await expect(page.locator('.password-group input')).toHaveCount(2)
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text')
  await expect(page.getByLabel('Confirmar contraseña')).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click()
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
  await expect(page.getByRole('alert')).toContainText('no coinciden')
  await page.getByLabel('Confirmar contraseña').fill('test-password-only')
  await page.screenshot({ path: info.outputPath('register-light.png'), fullPage: true })
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Tu cuenta está lista' })).toBeVisible()
  expect(api.registrations).toBe(1)
})

test('loads a real WebGL viewer, previews locally, saves the model and restores the session', async ({
  page,
}, info) => {
  const api = await mockApi(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page)
  await expect(page.getByRole('heading', { name: 'Hola, TestPlayer.' })).toBeVisible()
  await page.getByRole('link', { name: 'Apariencia', exact: true }).click()
  await expect(page.locator('[data-viewer-state="ready"]')).toBeVisible()
  await page
    .getByLabel('Elegir archivo de skin')
    .setInputFiles({ name: 'my-skin.png', mimeType: 'image/png', buffer: png() })
  await expect(page.getByText('my-skin.png')).toBeVisible()
  await expect(page.getByText('Cambios sin guardar', { exact: true })).toBeVisible()
  expect(api.uploads).toBe(0)
  await page.getByRole('radio', { name: /Slim/ }).check()
  await page.getByLabel('Animación', { exact: true }).selectOption('walk')
  await page.getByRole('button', { name: 'Pausar animación', exact: true }).click()
  await page.getByRole('button', { name: 'Acercar personaje' }).click()
  await page.getByRole('button', { name: 'Restablecer cámara' }).click()
  await page.getByRole('button', { name: 'Guardar skin', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Skin guardada' })).toBeVisible()
  expect(api.uploads).toBe(1)
  expect(api.model).toBe('slim')
  await expect(page.getByText('Sincronizado', { exact: true })).toBeVisible()
  await page.getByLabel('Tema de la interfaz').selectOption('dark')
  await page.screenshot({ path: info.outputPath('editor-dark.png'), fullPage: true })
  await page.getByLabel('Tema de la interfaz').selectOption('light')
  await page.screenshot({ path: info.outputPath('editor-light.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hola, TestPlayer.' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Slim/ })).toBeChecked()
  expect(errors).toEqual([])
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(api.invalidations).toBe(1)
  expect(await page.evaluate(() => sessionStorage.getItem('cubic-account-session-v1'))).toBeNull()
})

test('validates PNG dimensions and enforces the classic model for legacy skins', async ({
  page,
}) => {
  const api = await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: 'Apariencia', exact: true }).click()
  await page
    .getByLabel('Elegir archivo de skin')
    .setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not a png') })
  await expect(page.getByRole('alert')).toContainText('PNG válida')
  await page
    .getByLabel('Elegir archivo de skin')
    .setInputFiles({ name: 'legacy.png', mimeType: 'image/png', buffer: png(32) })
  await expect(page.getByRole('radio', { name: /Slim/ })).toBeDisabled()
  await expect(page.getByRole('radio', { name: /Clásico/ })).toBeChecked()
  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar skin', exact: true })).toBeDisabled()
  expect(api.uploads).toBe(0)
})

test('animates the confirmation dialog, restores focus and deletes only after confirmation', async ({
  page,
}, info) => {
  const api = await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: 'Apariencia', exact: true }).click()
  const trigger = page.getByRole('button', { name: 'Quitar skin', exact: true })
  await trigger.click()
  const modal = page.getByRole('dialog', { name: 'Quitar tu skin' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(api.deletes).toBe(0)
  await trigger.click()
  await page.screenshot({ path: info.outputPath('animated-modal.png'), animations: 'disabled' })
  await modal.getByRole('button', { name: 'Sí, quitar skin', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Quitamos la skin' })).toBeVisible()
  expect(api.deletes).toBe(1)
})

test('respects reduced motion and keeps uploads available without WebGL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes('webgl')) return null
      return Reflect.apply(original, this, args)
    } as typeof original
  })
  await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: 'Apariencia', exact: true }).click()
  await expect(page.locator('[data-viewer-state="fallback"]')).toBeVisible()
  await expect(page.getByText('El visor 3D no está disponible', { exact: false })).toBeVisible()
  await page
    .getByLabel('Elegir archivo de skin')
    .setInputFiles({ name: 'skin.png', mimeType: 'image/png', buffer: png() })
  await expect(page.getByRole('button', { name: 'Guardar skin', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await page.getByRole('button', { name: 'Quitar skin', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) =>
        el
          .getAnimations()
          .every((a) => Number(a.effect?.getTiming().duration) === 0 || a.playState === 'finished'),
      ),
  ).toBe(true)
})
