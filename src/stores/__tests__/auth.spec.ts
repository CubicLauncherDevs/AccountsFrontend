import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth'

const session = {
  accessToken: 'a'.repeat(64),
  clientToken: 'test-client',
  selectedProfile: { id: 'b'.repeat(32), name: 'TestPlayer' },
}
beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('account session lifecycle', () => {
  it('refreshes a temporarily invalid session after a username change', async () => {
    sessionStorage.setItem('cubic-account-session-v1', JSON.stringify(session))
    const next = {
      ...session,
      accessToken: 'c'.repeat(64),
      selectedProfile: { ...session.selectedProfile, name: 'NewName' },
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({ error: 'ForbiddenOperationException' }, { status: 403 }),
        )
        .mockResolvedValueOnce(Response.json(next)),
    )
    const store = useAuthStore()
    await store.restore()
    expect(store.profile?.name).toBe('NewName')
    expect(JSON.parse(sessionStorage.getItem('cubic-account-session-v1')!).accessToken).toBe(
      next.accessToken,
    )
  })
  it('keeps a valid session when the current password is incorrect on an account change', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(session))
        .mockResolvedValueOnce(
          Response.json(
            { error: 'ForbiddenOperationException', errorMessage: 'Invalid credentials.' },
            { status: 403 },
          ),
        ),
    )
    const store = useAuthStore()
    await store.login('TestPlayer', 'password')
    await expect(store.changeUsername('NewName', 'bad')).rejects.toMatchObject({
      status: 403,
      message: 'La contraseña actual no es correcta.',
    })
    expect(store.session?.accessToken).toBe(session.accessToken)
  })
  it('logs in and restores a validated session without storing the password', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await useAuthStore().login('TestPlayer', 'secret-password')
    expect(useAuthStore().profile?.id).toBe(session.selectedProfile.id)
    expect(sessionStorage.getItem('cubic-account-session-v1')).not.toContain('secret-password')
    setActivePinia(createPinia())
    await useAuthStore().restore()
    expect(useAuthStore().session).toEqual(session)
    expect(fetcher.mock.calls[1]?.[0]).toContain('/authserver/validate')
  })
  it('clears expired sessions but keeps the saved candidate on a temporary outage', async () => {
    sessionStorage.setItem('cubic-account-session-v1', JSON.stringify(session))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'ServiceUnavailable' }, { status: 503 })),
    )
    const store = useAuthStore()
    await store.restore()
    expect(store.session).toBeNull()
    expect(store.restoreError).toBeTruthy()
    expect(sessionStorage.getItem('cubic-account-session-v1')).not.toBeNull()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'ForbiddenOperationException' }, { status: 403 }),
        ),
    )
    await store.restore(true)
    expect(store.session).toBeNull()
    expect(sessionStorage.getItem('cubic-account-session-v1')).toBeNull()
  })
  it('clears revoked sessions when a protected skin operation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(session))
        .mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 })),
    )
    const store = useAuthStore()
    await store.login('TestPlayer', 'password')
    await expect(store.deleteSkin()).rejects.toMatchObject({ status: 401 })
    expect(store.session).toBeNull()
    expect(store.notice).toContain('caducó')
  })
  it('removes local credentials even when logout cannot reach the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(session))
        .mockRejectedValueOnce(new TypeError('offline')),
    )
    const store = useAuthStore()
    await store.login('TestPlayer', 'password')
    await store.logout()
    expect(store.session).toBeNull()
    expect(sessionStorage.getItem('cubic-account-session-v1')).toBeNull()
    expect(store.notice).toContain('revocación')
  })
  it('discards malformed stored sessions without contacting the API', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    sessionStorage.setItem('cubic-account-session-v1', '{"accessToken":"fake"}')
    await useAuthStore().restore()
    expect(fetcher).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('cubic-account-session-v1')).toBeNull()
  })
})
