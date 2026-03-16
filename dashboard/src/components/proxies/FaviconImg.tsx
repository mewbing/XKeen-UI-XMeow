import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'

/** Extract hostname from a URL string, returns null on failure */
function extractDomain(url: string): string | null {
  try { return new URL(url).hostname } catch { return null }
}

/** Build ordered list of favicon URLs to try */
function buildFaviconChain(iconUrl?: string | null, testUrl?: string | null): string[] {
  const urls: string[] = []

  // 1. Direct icon URL (if not a bare /favicon.ico — those are unreliable)
  if (iconUrl) {
    const isBareFavicon = /\/favicon\.ico$/i.test(iconUrl)
    if (!isBareFavicon) {
      urls.push(iconUrl)
    }
    // Extract domain for service-based fallbacks
    const domain = extractDomain(iconUrl)
    if (domain) {
      urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`)
      urls.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`)
    }
  }

  // 2. testUrl-based favicons (if no icon or as additional fallback)
  if (testUrl) {
    const domain = extractDomain(testUrl)
    if (domain) {
      const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      const ddgUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`
      if (!urls.includes(googleUrl)) urls.push(googleUrl)
      if (!urls.includes(ddgUrl)) urls.push(ddgUrl)
    }
  }

  return urls
}

interface FaviconImgProps {
  iconUrl?: string | null
  testUrl?: string | null
  name: string
  className?: string
}

export function FaviconImg({ iconUrl, testUrl, name, className }: FaviconImgProps) {
  const urls = useMemo(() => buildFaviconChain(iconUrl, testUrl), [iconUrl, testUrl])
  const [stage, setStage] = useState(0)

  // Reset stage when sources change
  useEffect(() => { setStage(0) }, [iconUrl, testUrl])

  // No URLs at all — show letter fallback
  if (urls.length === 0 || stage >= urls.length) {
    const letter = name.charAt(0).toUpperCase()
    return (
      <div className={cn(
        'size-5 shrink-0 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground select-none',
        className
      )}>
        {letter}
      </div>
    )
  }

  return (
    <img
      src={urls[stage]}
      alt=""
      className={cn('size-5 shrink-0 rounded', className)}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
    />
  )
}
