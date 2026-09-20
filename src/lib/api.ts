import { getActivePinia } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'

export const API_URL = (
  import.meta.env.VITE_AUTH_API_URL || 'https://auth.cubiclauncher.org'
).replace(/\/$/, '')
const REQUEST_BASE = import.meta.env.DEV ? '/api' : API_URL

export interface PlayerProfile {
  id: string
  name: string
}
export interface AuthSession {
  accessToken: string
  clientToken: string
  selectedProfile: PlayerProfile
}
export type SkinModel = 'default' | 'slim'
export interface PlayerSkin {
  url: string
  model: SkinModel
}
export interface AccountDetails {
  email: string
  emailConfirmed: boolean
  pendingEmail: string | null
  createdAt: string
  nameHistory: { previousName: string; newName: string; changedAt: string }[]
  historyTotal: number
}
export interface FullProfile extends PlayerProfile {
  properties: { name: string; value: string; signature?: string }[]
}
export interface ServerMetadata {
  meta: { serverName?: string; registrationEnabled?: boolean }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = 'ConnectionError',
    public diagnostic = '',
    public presentation: 'inline' | 'toast' = 'inline',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const messages: Record<string, string> = {
  AccountBanned:
    'Tu cuenta está suspendida. Contactá al equipo de CubicLauncher si necesitás ayuda.',
  EmailNotConfirmed:
    'Confirmá tu correo para entrar. Revisá tu bandeja de entrada o pedí un nuevo enlace.',
  TooManyRequests: 'Demasiados intentos. Esperá unos minutos antes de volver a probar.',
  SupabaseRateLimited:
    'El servicio está recibiendo demasiadas peticiones. Intentá de nuevo más tarde.',
  ConfigurationError: 'El servicio todavía necesita configuración. Contactá al administrador.',
  DatabaseFunctionMissing: 'La base de datos del servicio todavía no está lista.',
  SupabaseConnectionFailed:
    'No se pudo conectar con la base de datos. Intentá de nuevo en un momento.',
  SupabaseTimeout: 'El servicio tardó demasiado en responder. Intentá de nuevo.',
  UsernameTaken: 'Ese nombre de Minecraft ya está en uso.',
  EmailUnavailable: 'Ese correo no se puede usar. Elegí otro.',
  VerificationUnavailable:
    'No pudimos enviar el correo de verificación. Intentá más tarde o revisá la configuración de correo del servicio.',
  AuthUpdateUnavailable: 'Supabase no pudo actualizar tu cuenta. Intentá más tarde.',
  ReauthenticationRequired:
    'Supabase pide una verificación adicional para este cambio. Revisá la configuración de autenticación.',
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${REQUEST_BASE}${path}`, {
      ...options,
      credentials: 'omit',
      signal: options.signal ?? AbortSignal.timeout(20_000),
    })
  } catch {
    const message = 'No se pudo conectar con CubAuth.'
    const pinia = getActivePinia()
    if (pinia) useNotificationsStore(pinia).showConnectionError(message)
    throw new ApiError(
      message,
      0,
      'ConnectionError',
      'Si el problema continúa, comprobá que el Worker permita el origen de esta web mediante CORS.',
      'toast',
    )
  }
  let body: unknown = null
  if (response.status !== 204) {
    try {
      body = await response.json()
    } catch {
      throw new ApiError(
        'El servidor devolvió una respuesta inesperada.',
        response.status,
        'InvalidResponse',
        `HTTP ${response.status}. Si es un bloqueo de Cloudflare, revisá las reglas del subdominio de autenticación.`,
      )
    }
  }
  if (!response.ok) {
    const error = (body ?? {}) as {
      error?: string
      errorMessage?: string
      details?: { operation?: string; upstreamStatus?: number; upstreamCode?: string }
    }
    const code = error.error ?? 'RequestFailed'
    let message = messages[code] ?? error.errorMessage ?? 'No se pudo completar la operación.'
    const accountBlocked = code === 'AccountBanned' || code === 'EmailNotConfirmed'
    if (accountBlocked) {
      message = messages[code]!
    } else if (path === '/authserver/authenticate' && response.status === 403) {
      message = 'Usuario o contraseña incorrectos.'
    } else if (
      ['/account/username', '/account/email', '/account/password'].includes(path) &&
      code === 'ForbiddenOperationException' &&
      response.status === 403
    ) {
      message = 'La contraseña actual no es correcta.'
    } else if (code === 'ReauthenticationRequired') {
      message = messages.ReauthenticationRequired!
    } else if (
      (response.status === 401 || response.status === 403) &&
      path !== '/account/register'
    ) {
      message = 'Tu sesión ya no es válida. Volvé a iniciar sesión.'
    } else if (response.status >= 500 && !messages[code]) {
      message = 'El servicio no está disponible en este momento. Intentá de nuevo más tarde.'
    }
    const details = error.details
    const diagnostic = [
      !accountBlocked && error.errorMessage !== message ? error.errorMessage : undefined,
      details?.operation,
      details?.upstreamStatus ? `HTTP ${details.upstreamStatus}` : undefined,
      details?.upstreamCode,
    ]
      .filter(Boolean)
      .join(' · ')
    throw new ApiError(message, response.status, code, diagnostic)
  }
  return body as T
}

export const post = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export function parseSkin(profile: FullProfile): PlayerSkin | null {
  const property = profile.properties.find((item) => item.name === 'textures')
  if (!property) return null
  try {
    const json = JSON.parse(atob(property.value)) as {
      textures?: { SKIN?: { url?: unknown; metadata?: { model?: string } } }
    }
    const skin = json.textures?.SKIN
    if (!skin) return null
    if (typeof skin.url !== 'string' || new URL(skin.url).protocol !== 'https:')
      throw new Error('Invalid URL')
    return { url: skin.url, model: skin.metadata?.model === 'slim' ? 'slim' : 'default' }
  } catch {
    throw new ApiError(
      'No se pudo interpretar la skin guardada en tu perfil.',
      502,
      'InvalidProfile',
    )
  }
}

export function errorInfo(error: unknown): { message: string; diagnostic: string } {
  if (error instanceof ApiError && error.presentation === 'toast')
    return { message: '', diagnostic: '' }
  return error instanceof ApiError
    ? { message: error.message, diagnostic: error.diagnostic }
    : {
        message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
        diagnostic: '',
      }
}
