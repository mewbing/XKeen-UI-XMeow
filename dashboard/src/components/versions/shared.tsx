import { useCallback, useState } from 'react'
import { Copy, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

/** Copy text to clipboard -- works over HTTP via fallback. */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
  }
  return fallbackCopy(text)
}

function fallbackCopy(text: string): Promise<void> {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return Promise.resolve()
}

export function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(() => {
    copyToClipboard(text).then(() => {
      setCopied(true)
      toast.success('Скопировано')
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])

  return (
    <button
      onClick={handle}
      className="shrink-0 p-1 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
      title="Копировать"
    >
      {copied ? (
        <CheckCircle2 className="size-4 text-green-400" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  )
}

export function CmdLine({ cmd, label }: { cmd: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CopyBtn text={cmd} />
      <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">{cmd}</code>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

/** Format version string: returns '--' for empty, prepends 'v' if missing. */
export function fmtVer(v: string): string {
  if (!v) return '--'
  return v.startsWith('v') ? v : `v${v}`
}

/** Russian locale date formatting. */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
