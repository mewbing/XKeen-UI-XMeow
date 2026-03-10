/**
 * Setup guide component — shows step-by-step installation instructions
 * when required APIs are unreachable.
 */

import { CheckCircle2, XCircle, Loader2, RotateCcw, Settings, Terminal, Copy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'

interface SetupGuideProps {
  mihomoOk: boolean | null
  configApiOk: boolean | null
  loading: boolean
  onRetry: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      title="Копировать"
    >
      {copied ? (
        <CheckCircle2 className="size-3.5 text-green-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative group">
      <pre className="bg-background/80 border rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto">
        {children}
      </pre>
      <CopyButton text={children} />
    </div>
  )
}

function StatusRow({ label, url, ok }: { label: string; url: string; ok: boolean | null }) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
      ok === true && 'border-green-500/30 bg-green-500/5',
      ok === false && 'border-destructive/30 bg-destructive/5',
    )}>
      {ok === true ? (
        <CheckCircle2 className="size-5 text-green-500 shrink-0" />
      ) : (
        <XCircle className="size-5 text-destructive shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">{url}</div>
      </div>
      <div className={cn(
        'ml-auto text-xs font-medium shrink-0',
        ok ? 'text-green-500' : 'text-destructive',
      )}>
        {ok ? 'Подключено' : 'Недоступен'}
      </div>
    </div>
  )
}

function MihomoGuide() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Terminal className="size-4" />
        Настройка Mihomo API
      </h3>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p><span className="font-medium text-foreground">1.</span> Убедитесь что mihomo (xkeen) запущен:</p>
        <CodeBlock>xkeen -status</CodeBlock>

        <p><span className="font-medium text-foreground">2.</span> Проверьте <code className="text-xs bg-muted px-1 py-0.5 rounded">external-controller</code> в конфиге:</p>
        <CodeBlock>grep external-controller /opt/etc/mihomo/config.yaml</CodeBlock>
        <p className="text-xs">Должно быть: <code className="bg-muted px-1 py-0.5 rounded">external-controller: 0.0.0.0:9090</code></p>

        <p><span className="font-medium text-foreground">3.</span> Если не установлен, установите xkeen:</p>
        <CodeBlock>{`opkg update
opkg install curl
curl -L -o /tmp/xkeen.sh https://raw.githubusercontent.com/Jemal2020/xkeen/main/install.sh
sh /tmp/xkeen.sh`}</CodeBlock>

        <p><span className="font-medium text-foreground">4.</span> Проверьте доступность API:</p>
        <CodeBlock>curl http://localhost:9090/version</CodeBlock>
      </div>
    </div>
  )
}

function ConfigApiGuide() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Terminal className="size-4" />
        Установка XMeow Backend
      </h3>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p><span className="font-medium text-foreground">1.</span> Установите одной командой через SSH:</p>
        <CodeBlock>{`curl -sSL https://raw.githubusercontent.com/mewbing/XKeen-UI-XMeow/master/setup.sh | sh`}</CodeBlock>

        <p className="text-xs">Скрипт автоматически определит архитектуру, скачает бинарник и настроит автозапуск.</p>

        <p><span className="font-medium text-foreground">2.</span> Или установите вручную:</p>
        <CodeBlock>{`# Скачать бинарник (ARM64 для Keenetic)
curl -L -o /opt/bin/xmeow-server \\
  https://github.com/mewbing/XKeen-UI-XMeow/releases/latest/download/xmeow-server-linux-arm64
chmod +x /opt/bin/xmeow-server

# Создать init-скрипт для автозапуска
cat > /opt/etc/init.d/S99xmeow-server << 'INITEOF'
#!/bin/sh
PIDFILE=/opt/var/run/xmeow-server.pid
case "$1" in
  start)
    /opt/bin/xmeow-server >> /opt/var/log/xmeow-server.log 2>&1 &
    echo $! > "$PIDFILE"
    ;;
  stop)
    [ -f "$PIDFILE" ] && kill $(cat "$PIDFILE") && rm "$PIDFILE"
    ;;
esac
INITEOF
chmod +x /opt/etc/init.d/S99xmeow-server

# Запустить
/opt/etc/init.d/S99xmeow-server start`}</CodeBlock>

        <p><span className="font-medium text-foreground">3.</span> Проверьте доступность:</p>
        <CodeBlock>curl http://localhost:5000/api/health</CodeBlock>
        <p className="text-xs">Ожидаемый ответ: <code className="bg-muted px-1 py-0.5 rounded">{`{"status":"ok"}`}</code></p>
      </div>
    </div>
  )
}

export function SetupGuide({ mihomoOk, configApiOk, loading, onRetry }: SetupGuideProps) {
  const mihomoUrl = useSettingsStore((s) => s.mihomoApiUrl)
  const configUrl = useSettingsStore((s) => s.configApiUrl)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Проверка подключения...</p>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-center py-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-6 pt-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold">Требуется настройка</h2>
            <p className="text-sm text-muted-foreground">
              Некоторые сервисы недоступны. Следуйте инструкциям ниже.
            </p>
          </div>

          {/* Status rows */}
          <div className="space-y-2">
            {mihomoOk !== null && (
              <StatusRow label="Mihomo API" url={mihomoUrl} ok={mihomoOk} />
            )}
            {configApiOk !== null && (
              <StatusRow label="XMeow Backend" url={configUrl} ok={configApiOk} />
            )}
          </div>

          {/* Guides for failed services */}
          <div className="space-y-6">
            {mihomoOk === false && <MihomoGuide />}
            {configApiOk === false && <ConfigApiGuide />}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.dispatchEvent(new Event('open-settings'))}
            >
              <Settings className="size-4" />
              Настройки
            </Button>
            <Button className="flex-1" onClick={onRetry}>
              <RotateCcw className="size-4" />
              Повторить проверку
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
