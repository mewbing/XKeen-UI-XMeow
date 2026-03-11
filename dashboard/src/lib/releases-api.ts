/**
 * Releases API client for mihomo/xkeen/xmeow version management.
 */

import { useSettingsStore } from '@/stores/settings'

function getBaseUrl(): string {
  return useSettingsStore.getState().configApiUrl
}

function authHeaders(): Record<string, string> {
  const secret = useSettingsStore.getState().mihomoSecret
  if (secret) return { Authorization: `Bearer ${secret}` }
  return {}
}

// --- Mihomo ---

export interface MihomoRelease {
  tag_name: string
  published_at: string
  body: string
  asset_name: string
  asset_size: number
  is_current: boolean
  is_newer: boolean
}

export interface MihomoReleasesResponse {
  current_version: string
  releases: MihomoRelease[]
}

/** Fetch 10 latest mihomo releases from GitHub (cached 15 min server-side). */
export async function fetchMihomoReleases(): Promise<MihomoReleasesResponse> {
  const res = await fetch(`${getBaseUrl()}/api/releases/mihomo`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to fetch mihomo releases: ${res.status}`)
  }
  return res.json()
}

// --- XMeow ---

export interface XmeowRelease {
  tag_name: string
  published_at: string
  body: string
  server_asset_name: string
  server_asset_size: number
  dist_asset_name: string
  dist_asset_size: number
  is_current: boolean
  is_newer: boolean
}

export interface XmeowReleasesResponse {
  current_version: string
  releases: XmeowRelease[]
}

/** Fetch 10 latest xmeow releases from GitHub (cached 15 min server-side). */
export async function fetchXmeowReleases(): Promise<XmeowReleasesResponse> {
  const res = await fetch(`${getBaseUrl()}/api/releases/xmeow`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to fetch xmeow releases: ${res.status}`)
  }
  return res.json()
}

/** Install a specific xmeow version with real-time progress streaming. */
export async function installXmeowVersion(
  version: string,
  target: 'server' | 'dist',
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/releases/xmeow/install`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, target }),
    signal: AbortSignal.timeout(300000),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Install failed: ${res.status}`)
  }

  await readNDJSONStream(res, onProgress)
}

// --- XKeen ---

export interface XkeenRelease {
  tag_name: string
  published_at: string
  body: string
  is_current: boolean
  is_newer: boolean
}

export interface XkeenReleasesResponse {
  current_version: string
  releases: XkeenRelease[]
}

/** Fetch 10 latest xkeen releases from GitHub (cached 15 min server-side). */
export async function fetchXkeenReleases(): Promise<XkeenReleasesResponse> {
  const res = await fetch(`${getBaseUrl()}/api/releases/xkeen`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Failed to fetch xkeen releases: ${res.status}`)
  }
  return res.json()
}

// --- Direct GitHub API (no backend needed) ---

const MIHOMO_REPO = 'MetaCubeX/mihomo'
const XMEOW_REPO = 'mewbing/XKeen-UI-XMeow'
const XKEEN_REPO = 'jameszeroX/XKeen'

interface GitHubAsset {
  name: string
  size: number
}

interface GitHubRelease {
  tag_name: string
  published_at: string
  body: string | null
  assets: GitHubAsset[]
}

/** Compare two version strings (e.g. "0.2.0" vs "0.1.0"). Returns >0 if a > b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Fetch XMeow releases directly from GitHub API (no backend required).
 * Used as fallback when Go backend is unavailable.
 * Rate limit: 60 req/hour without auth — more than enough.
 */
export async function fetchXmeowReleasesFromGitHub(): Promise<XmeowReleasesResponse> {
  const res = await fetch(
    `https://api.github.com/repos/${XMEOW_REPO}/releases?per_page=10`,
    { signal: AbortSignal.timeout(15000) },
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`)
  const raw: GitHubRelease[] = await res.json()

  const currentVersion = __APP_VERSION__
  const releases: XmeowRelease[] = raw.map((r) => {
    const ver = r.tag_name.replace(/^v/, '')
    const serverAsset = r.assets.find(
      (a) => a.name.includes('linux_arm64') && a.name.endsWith('.tar.gz') && a.name !== 'dist.tar.gz',
    )
    const distAsset = r.assets.find((a) => a.name === 'dist.tar.gz')
    return {
      tag_name: r.tag_name,
      published_at: r.published_at,
      body: r.body || '',
      server_asset_name: serverAsset?.name || '',
      server_asset_size: serverAsset?.size || 0,
      dist_asset_name: distAsset?.name || '',
      dist_asset_size: distAsset?.size || 0,
      is_current: ver === currentVersion,
      is_newer: compareVersions(ver, currentVersion) > 0,
    }
  })

  return { current_version: currentVersion, releases }
}

/**
 * Quick check: is there a newer XMeow release on GitHub?
 * Fetches only the latest release. Used for update badge without backend.
 */
export async function checkXmeowUpdateFromGitHub(): Promise<{
  hasUpdate: boolean
  latestVersion: string
  releaseNotes: string
  publishedAt: string
}> {
  const res = await fetch(
    `https://api.github.com/repos/${XMEOW_REPO}/releases/latest`,
    { signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`)
  const release: GitHubRelease = await res.json()
  const latestVer = release.tag_name.replace(/^v/, '')
  return {
    hasUpdate: compareVersions(latestVer, __APP_VERSION__) > 0,
    latestVersion: release.tag_name,
    releaseNotes: release.body || '',
    publishedAt: release.published_at,
  }
}

/**
 * Fetch Mihomo releases directly from GitHub API (no backend required).
 * Used as fallback when Go backend is unavailable.
 * @param currentVersion — from mihomo API (/version), may be empty if mihomo is also down.
 */
export async function fetchMihomoReleasesFromGitHub(currentVersion: string): Promise<MihomoReleasesResponse> {
  const res = await fetch(
    `https://api.github.com/repos/${MIHOMO_REPO}/releases?per_page=15`,
    { signal: AbortSignal.timeout(15000) },
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`)
  const raw: GitHubRelease[] = await res.json()

  const cleanCurrent = currentVersion.replace(/^v/, '')
  const releases: MihomoRelease[] = raw
    .filter((r) =>
      r.assets.some(
        (a) => a.name.includes('linux-arm64') && a.name.endsWith('.gz') && !a.name.includes('-go1'),
      ),
    )
    .slice(0, 10)
    .map((r) => {
      const ver = r.tag_name.replace(/^v/, '')
      const asset = r.assets.find(
        (a) => a.name.includes('linux-arm64') && a.name.endsWith('.gz') && !a.name.includes('-go1'),
      )
      return {
        tag_name: r.tag_name,
        published_at: r.published_at,
        body: r.body || '',
        asset_name: asset?.name || '',
        asset_size: asset?.size || 0,
        is_current: cleanCurrent ? ver === cleanCurrent : false,
        is_newer: cleanCurrent ? compareVersions(ver, cleanCurrent) > 0 : false,
      }
    })

  return { current_version: currentVersion, releases }
}

/**
 * Fetch XKeen releases directly from GitHub API (no backend required).
 * Used as fallback when Go backend is unavailable.
 * @param currentVersion — from Go backend, may be empty.
 */
export async function fetchXkeenReleasesFromGitHub(currentVersion: string): Promise<XkeenReleasesResponse> {
  const res = await fetch(
    `https://api.github.com/repos/${XKEEN_REPO}/releases?per_page=10`,
    { signal: AbortSignal.timeout(15000) },
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`)
  const raw: GitHubRelease[] = await res.json()

  const cleanCurrent = currentVersion.replace(/^v/, '')
  const releases: XkeenRelease[] = raw.map((r) => {
    const ver = r.tag_name.replace(/^v/, '')
    return {
      tag_name: r.tag_name,
      published_at: r.published_at,
      body: r.body || '',
      is_current: cleanCurrent ? ver === cleanCurrent : false,
      is_newer: cleanCurrent ? compareVersions(ver, cleanCurrent) > 0 : false,
    }
  })

  return { current_version: currentVersion, releases }
}

// --- Quick update checks (lightweight, for startup indicators) ---
// Try Go backend first (local network, 15-min cache — fast).
// Fall back to direct GitHub if backend unavailable.

/**
 * Quick check: is there a newer Mihomo release?
 * 1. Go backend (local, cached) → fast
 * 2. Fallback: mihomo API for version + GitHub for latest release
 */
export async function checkMihomoUpdateQuick(currentVersion?: string): Promise<boolean> {
  // 1. Try Go backend (local network, already knows current version, 15-min cache)
  try {
    const res = await fetch(`${getBaseUrl()}/api/releases/mihomo`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data: MihomoReleasesResponse = await res.json()
      return data.releases.some((r) => r.is_newer)
    }
  } catch {}

  // 2. Fallback: check GitHub directly using known version or fetching from mihomo
  try {
    let version = currentVersion
    if (!version) {
      const { mihomoApiUrl, mihomoSecret } = useSettingsStore.getState()
      const headers: Record<string, string> = mihomoSecret
        ? { Authorization: `Bearer ${mihomoSecret}` }
        : {}
      const verRes = await fetch(`${mihomoApiUrl}/version`, {
        headers,
        signal: AbortSignal.timeout(3000),
      })
      if (!verRes.ok) return false
      const data = await verRes.json()
      version = data.version
    }
    if (!version) return false

    const res = await fetch(
      `https://api.github.com/repos/${MIHOMO_REPO}/releases?per_page=5`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return false
    const raw: GitHubRelease[] = await res.json()
    const cleanCurrent = version.replace(/^v/, '')
    const latest = raw.find((r) =>
      r.assets.some((a) => a.name.includes('linux-arm64') && a.name.endsWith('.gz') && !a.name.includes('-go1')),
    )
    if (!latest) return false
    return compareVersions(latest.tag_name.replace(/^v/, ''), cleanCurrent) > 0
  } catch {
    return false
  }
}

/**
 * Quick check: is there a newer XKeen release?
 * Go backend only — xkeen version not available without backend.
 */
export async function checkXkeenUpdateQuick(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/releases/xkeen`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data: XkeenReleasesResponse = await res.json()
      return data.releases.some((r) => r.is_newer)
    }
  } catch {}
  return false
}

// --- Shared ---

export interface InstallProgress {
  step: 'check_disk' | 'download' | 'checksum' | 'decompress' | 'extract' | 'stop' | 'backup' | 'install' | 'start' | 'done' | 'error'
  message: string
  progress?: number
}

/**
 * Install a specific mihomo version with real-time progress streaming.
 * Reads NDJSON stream and calls onProgress for each step.
 */
export async function installMihomoVersion(
  version: string,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/releases/mihomo/install`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
    signal: AbortSignal.timeout(300000),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || `Install failed: ${res.status}`)
  }

  await readNDJSONStream(res, onProgress)
}

/** Read NDJSON stream from a fetch response. */
async function readNDJSONStream(
  res: Response,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        onProgress(JSON.parse(trimmed) as InstallProgress)
      } catch { /* skip malformed */ }
    }
  }

  if (buffer.trim()) {
    try {
      onProgress(JSON.parse(buffer.trim()) as InstallProgress)
    } catch { /* skip */ }
  }
}
