/**
 * Country flag utilities for proxy names.
 *
 * Parses country codes from proxy name patterns like
 * "🇳🇱 Server", "NL Amsterdam", "US-Server-01"
 * and provides the cleaned display name without the code prefix.
 */

/**
 * Extract 2-letter ISO country code from proxy name.
 */
export function extractCountryCode(name: string): string | null {
  // Regional indicator emoji pairs
  const flagMatch = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)
  if (flagMatch) {
    const chars = [...flagMatch[0]]
    return chars
      .map((c) => String.fromCharCode(c.codePointAt(0)! - 0x1F1E6 + 0x41))
      .join('')
      .toLowerCase()
  }

  // 2-letter code at start followed by non-alpha separator
  // Skip if rest starts with Cyrillic (group names like "RU трафик")
  const textMatch = name.match(/^([A-Za-z]{2})([\s\-_.\d])/)
  if (textMatch) {
    const rest = name.slice(textMatch[0].length)
    if (!/^[\u0400-\u04FF]/.test(rest)) {
      return textMatch[1].toLowerCase()
    }
  }

  return null
}

/**
 * Get display name with country code prefix stripped.
 *
 * @example getDisplayName("NL Amsterdam 01") → "Amsterdam 01"
 * @example getDisplayName("🇳🇱 Server")      → "Server"
 * @example getDisplayName("US-East-1")       → "East-1"
 * @example getDisplayName("Direct")          → "Direct"
 */
export function getDisplayName(name: string): string {
  // Strip flag emoji prefix
  const withoutEmoji = name.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '')
  if (withoutEmoji !== name && withoutEmoji) return withoutEmoji

  // Strip 2-letter code + separators (skip if followed by Cyrillic)
  const codeMatch = name.match(/^[A-Za-z]{2}([\s\-_.\d])/)
  if (codeMatch) {
    const after = name.slice(codeMatch[0].length)
    if (!/^[\u0400-\u04FF]/.test(after)) {
      const result = name.slice(2).replace(/^[\s\-_.]+/, '')
      if (result) return result
    }
  }

  return name
}
