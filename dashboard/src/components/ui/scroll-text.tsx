import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ScrollTextProps {
  className?: string
  children: React.ReactNode
}

export function ScrollText({ className, children }: ScrollTextProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<Animation | null>(null)
  const [overflow, setOverflow] = useState(0)

  // Detect overflow via ResizeObserver
  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const check = () => {
      setOverflow(Math.max(0, inner.scrollWidth - outer.clientWidth))
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  // Auto-scroll animation when overflowing
  useEffect(() => {
    const inner = innerRef.current
    if (animRef.current) {
      animRef.current.cancel()
      animRef.current = null
    }
    if (!inner || overflow <= 0) return

    const duration = 2000 + overflow * 30
    animRef.current = inner.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(0)', offset: 0.2 },
        { transform: `translateX(-${overflow}px)`, offset: 0.5 },
        { transform: `translateX(-${overflow}px)`, offset: 0.7 },
        { transform: 'translateX(0)' },
      ],
      { duration, iterations: Infinity },
    )

    return () => {
      animRef.current?.cancel()
      animRef.current = null
    }
  }, [overflow])

  return (
    <div
      ref={outerRef}
      className={cn('overflow-hidden', className)}
    >
      <span ref={innerRef} className="inline-flex items-center whitespace-nowrap gap-1">
        {children}
      </span>
    </div>
  )
}
