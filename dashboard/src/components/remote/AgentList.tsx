import { useState, useCallback } from 'react'
import { Monitor, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentCard } from '@/components/remote/AgentCard'
import type { AgentInfo } from '@/lib/remote-api'

const INSTALL_COMMAND = 'curl -sL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/main/setup.sh | sh -s -- --agent'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        throw new Error('no secure context')
      }
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCopy}
      title="Копировать"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

interface AgentListProps {
  agents: AgentInfo[]
  onConnect: (id: string) => void
  onDelete: (id: string) => void
}

export function AgentList({ agents, onConnect, onDelete }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Icon + title */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="rounded-xl bg-muted p-4">
              <Monitor className="size-10 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">
                Удалённое управление
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                Подключайте роутеры из других локаций для управления через единую панель.
                Установите XMeow Agent на удалённом роутере и подключите его к этому серверу.
              </p>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="flex items-center justify-center rounded-full bg-primary/10 text-primary size-5 text-xs font-medium shrink-0 mt-0.5">1</span>
                <span className="text-muted-foreground">Сгенерируйте токен для нового агента</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex items-center justify-center rounded-full bg-primary/10 text-primary size-5 text-xs font-medium shrink-0 mt-0.5">2</span>
                <span className="text-muted-foreground">Установите агент на удалённом роутере:</span>
              </div>
            </div>

            {/* Install command */}
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="text-xs font-mono text-foreground break-all flex-1">
                {INSTALL_COMMAND}
              </code>
              <CopyButton text={INSTALL_COMMAND} />
            </div>

            <div className="flex items-start gap-2">
              <span className="flex items-center justify-center rounded-full bg-primary/10 text-primary size-5 text-xs font-medium shrink-0 mt-0.5">3</span>
              <span className="text-muted-foreground">
                Введите адрес этого сервера и токен при установке
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onConnect={onConnect}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
