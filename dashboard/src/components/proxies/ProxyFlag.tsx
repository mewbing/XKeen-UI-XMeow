import { cn } from '@/lib/utils'
import { extractCountryCode } from '@/lib/flags'

interface ProxyFlagProps {
  name: string
  className?: string
}

export function ProxyFlag({ name, className }: ProxyFlagProps) {
  const code = extractCountryCode(name)
  if (!code) return null

  return (
    <img
      src={`https://flagcdn.com/w20/${code}.png`}
      srcSet={`https://flagcdn.com/w40/${code}.png 2x`}
      alt={code.toUpperCase()}
      className={cn('inline-block shrink-0 rounded-[2px]', className)}
      loading="lazy"
      onError={(e) => {
        ;(e.target as HTMLElement).style.display = 'none'
      }}
    />
  )
}
