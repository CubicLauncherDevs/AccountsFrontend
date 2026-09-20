import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, parseSkin, request } from '../api'

afterEach(() => vi.unstubAllGlobals())

describe('API errors and texture payloads', () => {
  it.each([
    ['AccountBanned', 'Tu cuenta está suspendida.'],
    ['EmailNotConfirmed', 'Confirmá tu correo para entrar.'],
  ])(
    'preserves the actionable %s state instead of reporting an incorrect password',
    async (code, message) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            Response.json(
              { error: code, errorMessage: 'English provider message.' },
              { status: 403 },
            ),
          ),
      )
      await expect(request('/authserver/authenticate')).rejects.toMatchObject({
        code,
        status: 403,
        message: expect.stringContaining(message),
        diagnostic: '',
      })
    },
  )
  it('preserves actionable backend diagnostics on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: 'DatabaseFunctionMissing',
            errorMessage: 'Apply migration.',
            details: {
              operation: 'cubauth_rate_limit',
              upstreamStatus: 404,
              upstreamCode: 'PGRST202',
            },
          },
          { status: 503 },
        ),
      ),
    )
    await expect(request('/account/register')).rejects.toMatchObject({
      status: 503,
      code: 'DatabaseFunctionMissing',
      diagnostic: 'Apply migration. · cubauth_rate_limit · HTTP 404 · PGRST202',
    })
  })
  it('explains non-JSON Cloudflare blocks and network/CORS failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('error code: 1010', { status: 403 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetcher)
    await expect(request('/')).rejects.toMatchObject({ code: 'InvalidResponse', status: 403 })
    await expect(request('/')).rejects.toMatchObject({
      code: 'ConnectionError',
      status: 0,
      diagnostic: expect.stringContaining('CORS'),
    })
  })
  it('accepts empty 204 responses without attempting JSON parsing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await request('/authserver/validate')).toBeNull()
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'omit' }),
    )
  })
  it('decodes saved models and rejects malformed or non-HTTPS textures', () => {
    const profile = (value: unknown) => ({
      id: 'a'.repeat(32),
      name: 'Player',
      properties: [{ name: 'textures', value: btoa(JSON.stringify(value)) }],
    })
    expect(
      parseSkin(
        profile({
          textures: { SKIN: { url: 'https://example.com/skin', metadata: { model: 'slim' } } },
        }),
      ),
    ).toEqual({ url: 'https://example.com/skin', model: 'slim' })
    expect(parseSkin(profile({ textures: {} }))).toBeNull()
    expect(() =>
      parseSkin(profile({ textures: { SKIN: { url: 'javascript:alert(1)' } } })),
    ).toThrow(ApiError)
    expect(() =>
      parseSkin({
        id: 'a',
        name: 'Player',
        properties: [{ name: 'textures', value: 'invalid base64' }],
      }),
    ).toThrow(ApiError)
  })
})
