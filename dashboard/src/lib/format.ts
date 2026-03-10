/**
 * Formatting utilities for metrics display.
 *
 * All functions are pure -- no side effects, no external imports.
 */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/**
 * Convert bytes to human-readable string.
 * Uses 1024-based units: B, KB, MB, GB, TB.
 *
 * @example formatBytes(0)       -> "0 B"
 * @example formatBytes(1536)    -> "1.5 KB"
 * @example formatBytes(1048576) -> "1.0 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const clampedIndex = Math.min(i, UNITS.length - 1)
  const value = bytes / Math.pow(1024, clampedIndex)
  return `${value.toFixed(clampedIndex === 0 ? 0 : 1)} ${UNITS[clampedIndex]}`
}

/**
 * Format bytes per second as speed string.
 *
 * @example formatSpeed(1024) -> "1.0 KB/s"
 */
export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

/**
 * Format uptime from a start timestamp to human-readable duration.
 * Returns '--' if startTime is null.
 *
 * @example formatUptime(Date.now() - 90000) -> "1m 30s"
 * @example formatUptime(null) -> "--"
 */
export function formatUptime(startTime: number | null): string {
  if (startTime === null) return '--'
  const diff = Math.floor((Date.now() - startTime) / 1000)
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/**
 * Format proxy delay in milliseconds to display string.
 * undefined = not tested, 0 = timeout/unreachable.
 *
 * @example formatDelay(120)       -> "120ms"
 * @example formatDelay(0)         -> "timeout"
 * @example formatDelay(undefined) -> "--"
 */
export function formatDelay(delay: number | undefined): string {
  if (delay === undefined) return '\u2014'
  if (delay === 0) return 'timeout'
  return `${delay}ms`
}
