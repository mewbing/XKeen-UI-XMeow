/**
 * API client for testing connections to mihomo and Config API.
 */

export interface ConnectionResult {
  ok: boolean
  version?: string
  error?: string
}

/**
 * Determine API URLs based on installation type.
 * - 'local': dashboard runs on the router itself, use window.location.hostname
 * - 'cdn': dashboard runs on external hosting, use provided routerIp
 */
export function getApiUrls(
  type: 'local' | 'cdn',
  routerIp?: string
): { mihomoUrl: string; configUrl: string } {
  if (type === 'local') {
    const host = window.location.hostname
    return {
      mihomoUrl: `http://${host}:9090`,
      configUrl: `http://${host}:5000`,
    }
  }
  // CDN mode: routerIp must be provided
  const ip = routerIp || '192.168.1.1'
  return {
    mihomoUrl: `http://${ip}:9090`,
    configUrl: `http://${ip}:5000`,
  }
}

/**
 * Translate fetch errors into human-readable Russian messages.
 */
function humanizeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Превышено время ожидания (5 сек)'
  }
  if (err instanceof TypeError) {
    // fetch network errors are TypeErrors
    return 'Не удалось подключиться'
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Неизвестная ошибка'
}

/**
 * Test connection to mihomo API by calling GET /version.
 * Uses AbortSignal.timeout(5000) for a 5-second timeout.
 */
export async function testMihomoConnection(
  url: string,
  secret?: string
): Promise<ConnectionResult> {
  try {
    const headers: Record<string, string> = {}
    if (secret) {
      headers['Authorization'] = `Bearer ${secret}`
    }

    const response = await fetch(`${url}/version`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Сервер ответил с ошибкой: ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      ok: true,
      version: data.version || data.meta?.version || 'unknown',
    }
  } catch (err) {
    return {
      ok: false,
      error: humanizeError(err),
    }
  }
}

/**
 * Test connection to Config API by calling GET /api/health.
 * Expects { status: "ok" } in response body.
 */
export async function testConfigApiConnection(
  url: string
): Promise<ConnectionResult> {
  try {
    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Сервер ответил с ошибкой: ${response.status}`,
      }
    }

    const data = await response.json()
    if (data.status === 'ok') {
      return { ok: true }
    }

    return {
      ok: false,
      error: 'Неожиданный ответ от сервера',
    }
  } catch (err) {
    return {
      ok: false,
      error: humanizeError(err),
    }
  }
}
