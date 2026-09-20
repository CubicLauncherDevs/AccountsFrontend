import { deflateSync } from 'node:zlib'
import type { Page } from '@playwright/test'

export const API = 'https://auth.cubiclauncher.org'
export const TEXTURE =
  'https://jsfuiarusrvydgwdacbk.supabase.co/storage/v1/object/public/skins/test-skin'
export const session = {
  accessToken: 'a'.repeat(64),
  clientToken: 'client-e2e',
  selectedProfile: { id: 'b'.repeat(32), name: 'TestPlayer' },
}

function chunk(type: string, data: Buffer) {
  const value = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of value) {
    crc ^= byte
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, value, checksum])
}

export function png(height = 64) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(64, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const pixels = Buffer.alloc(height * 257)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < 64; x++) {
      const offset = y * 257 + 1 + x * 4
      const head = y < 16 && x < 32,
        body = y >= 16 && y < 32,
        lower = y >= 48 && x < 48
      const color = head ? [196, 176, 152] : y < 32 && x < 40 ? [64, 91, 136] : [82, 86, 101]
      pixels.set([...color, head || body || lower ? 255 : 0], offset)
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export async function mockApi(
  page: Page,
  options: {
    loginError?: boolean | 'banned' | 'unconfirmed'
    confirmation?: boolean
    registration?: boolean
  } = {},
) {
  const state = {
    hasSkin: true,
    model: 'default',
    uploads: 0,
    deletes: 0,
    registrations: 0,
    invalidations: 0,
    name: 'TestPlayer',
    pendingEmail: null as string | null,
    passwordChanges: 0,
    verifications: 0,
    history: [] as { previousName: string; newName: string; changedAt: string }[],
  }
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
  await page.route(`${API}/**`, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    const empty = () => route.fulfill({ status: 204, headers: cors })
    if (req.method() === 'OPTIONS') return empty()
    if (path === '/') return json({ meta: { registrationEnabled: options.registration !== false } })
    if (path === '/authserver/authenticate') {
      const error =
        options.loginError === 'banned'
          ? 'AccountBanned'
          : options.loginError === 'unconfirmed'
            ? 'EmailNotConfirmed'
            : 'ForbiddenOperationException'
      return options.loginError
        ? json({ error, errorMessage: 'Authentication rejected.' }, 403)
        : json(session)
    }
    if (path === '/authserver/validate') return empty()
    if (path === '/authserver/invalidate') {
      state.invalidations++
      return empty()
    }
    if (path === '/account/register') {
      state.registrations++
      return json({ emailConfirmationRequired: options.confirmation ?? false }, 202)
    }
    if (path === '/account/me')
      return json({
        email: 'test@example.com',
        emailConfirmed: true,
        pendingEmail: state.pendingEmail,
        createdAt: '2026-01-10T12:00:00Z',
        nameHistory: state.history,
        historyTotal: state.history.length,
      })
    if (path === '/account/username') {
      const body = req.postDataJSON()
      if (body.currentPassword !== 'test-password-only')
        return json(
          { error: 'ForbiddenOperationException', errorMessage: 'Invalid credentials.' },
          403,
        )
      state.history.unshift({
        previousName: state.name,
        newName: body.username,
        changedAt: '2026-09-20T12:00:00Z',
      })
      state.name = body.username
      return json({
        session: {
          ...session,
          accessToken: 'c'.repeat(64),
          selectedProfile: { ...session.selectedProfile, name: state.name },
        },
      })
    }
    if (path === '/account/email') {
      state.pendingEmail = req.postDataJSON().email
      return json({ message: 'Pending confirmation' })
    }
    if (path === '/account/password') {
      state.passwordChanges++
      return json({
        session: {
          ...session,
          accessToken: 'd'.repeat(64),
          selectedProfile: { ...session.selectedProfile, name: state.name },
        },
      })
    }
    if (path === '/account/resend-verification') {
      state.verifications++
      return json({ message: 'Check email' }, 202)
    }
    if (path.startsWith('/sessionserver/session/minecraft/profile/'))
      return json({
        ...session.selectedProfile,
        name: state.name,
        properties: [
          {
            name: 'textures',
            value: Buffer.from(
              JSON.stringify({
                textures: state.hasSkin
                  ? { SKIN: { url: TEXTURE, metadata: { model: state.model } } }
                  : {},
              }),
            ).toString('base64'),
          },
        ],
      })
    if (path.endsWith('/skin') && req.method() === 'PUT') {
      state.uploads++
      state.hasSkin = true
      state.model = req.postData()?.includes('slim') ? 'slim' : 'default'
      return empty()
    }
    if (path.endsWith('/skin') && req.method() === 'DELETE') {
      state.deletes++
      state.hasSkin = false
      return empty()
    }
    return json({ error: 'NotFound', errorMessage: `Unexpected test route ${path}` }, 404)
  })
  await page.route(TEXTURE, (route) =>
    route.fulfill({ contentType: 'image/png', headers: cors, body: png() }),
  )
  return state
}

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo o nombre de Minecraft').fill('TestPlayer')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.waitForURL('**/account')
}
