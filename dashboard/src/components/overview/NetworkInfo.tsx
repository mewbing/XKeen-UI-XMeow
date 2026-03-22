import { useEffect, useState, useCallback } from 'react'
import {
  Globe,
  MapPin,
  Building2,
  Clock,
  Wifi,
  Activity,
  ArrowDownUp,
  Server,
  Zap,
  Settings,
  Plus,
  X,
  RotateCw,
} from 'lucide-react'
import { useOverviewStore } from '@/stores/overview'
import { useSettingsStore } from '@/stores/settings'
import { useRemoteStore } from '@/stores/remote'
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { fetchNetworkInfo, fetchProxyServers, type NetworkInfo as NetworkInfoData } from '@/lib/config-api'
import { fetchProxyDelay } from '@/lib/mihomo-api'
import { formatBytes, formatDelay } from '@/lib/format'
import { ProxyFlag } from '@/components/proxies/ProxyFlag'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}д ${hours}ч ${mins}м`
  if (hours > 0) return `${hours}ч ${mins}м`
  return `${mins}м`
}

function formatSessionTime(startTime: number | null): string {
  if (!startTime) return '—'
  const seconds = Math.floor((Date.now() - startTime) / 1000)
  return formatUptime(seconds)
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 group/row rounded-md px-1 -mx-1 transition-colors duration-200 hover:bg-accent/50">
      <Icon className="size-4 text-muted-foreground shrink-0 transition-colors duration-200 group-hover/row:text-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium ml-auto tabular-nums truncate max-w-[50%] text-right">
        {value}
      </span>
    </div>
  )
}

function faviconUrl(url: string): string | null {
  try {
    const origin = new URL(url).origin
    return `${origin}/favicon.ico`
  } catch {
    return null
  }
}

function delayColor(delay: number | null | undefined): string {
  if (delay == null || delay === 0) return 'text-muted-foreground'
  if (delay < 300) return 'text-green-500'
  if (delay < 600) return 'text-yellow-500'
  return 'text-red-500'
}

function LatencyTargetsSettings() {
  const targets = useSettingsStore((s) => s.latencyTargets)
  const addTarget = useSettingsStore((s) => s.addLatencyTarget)
  const removeTarget = useSettingsStore((s) => s.removeLatencyTarget)
  const setTargets = useSettingsStore((s) => s.setLatencyTargets)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const handleAdd = () => {
    const trimName = name.trim()
    const trimUrl = url.trim()
    if (!trimName || !trimUrl) return
    addTarget({ name: trimName, url: trimUrl })
    setName('')
    setUrl('')
  }

  const handleReset = () => {
    setTargets([
      { name: 'Cloudflare', url: 'https://www.cloudflare.com/cdn-cgi/trace' },
      { name: 'Google', url: 'https://www.gstatic.com/generate_204' },
      { name: 'YouTube', url: 'https://www.youtube.com/generate_204' },
      { name: 'GitHub', url: 'https://github.com' },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {targets.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="truncate flex-1">{t.name}</span>
            <span className="text-muted-foreground truncate max-w-[140px] text-xs">
              {t.url}
            </span>
            <button
              onClick={() => removeTarget(i)}
              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Input
          placeholder="Имя (например: Baidu)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="flex gap-1.5">
          <Input
            placeholder="URL (например: https://baidu.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            size="icon-xs"
            variant="outline"
            onClick={handleAdd}
            disabled={!name.trim() || !url.trim()}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>

      <Button
        variant="ghost"
        size="xs"
        className="w-full text-muted-foreground"
        onClick={handleReset}
      >
        Сбросить по умолчанию
      </Button>
    </div>
  )
}

export function NetworkInfoCard() {
  const backendAvailable = useBackendAvailable()
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const [netData, setNetData] = useState<NetworkInfoData | null>(null)
  const [proxyServers, setProxyServers] = useState<Record<string, string>>({})
  const startTime = useOverviewStore((s) => s.startTime)
  const activeConnections = useOverviewStore((s) => s.activeConnections)
  const downloadTotal = useOverviewStore((s) => s.downloadTotal)
  const uploadTotal = useOverviewStore((s) => s.uploadTotal)
  const [sessionTime, setSessionTime] = useState('')

  const latencyTargets = useSettingsStore((s) => s.latencyTargets)
  const [latencyResults, setLatencyResults] = useState<Map<string, number | null>>(new Map())
  const [testing, setTesting] = useState(false)

  // Fetch network info (requires Go backend)
  // Reset on context switch to avoid showing stale local data in remote mode
  useEffect(() => {
    setNetData(null)
    if (!backendAvailable) return
    fetchNetworkInfo().then(setNetData).catch(() => {})
    const interval = setInterval(() => {
      fetchNetworkInfo().then(setNetData).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [backendAvailable, activeAgentId])

  // Fetch proxy servers (requires Go backend)
  useEffect(() => {
    setProxyServers({})
    if (!backendAvailable) return
    fetchProxyServers().then(setProxyServers).catch(() => {})
  }, [backendAvailable, activeAgentId])

  // Session timer
  useEffect(() => {
    setSessionTime(formatSessionTime(startTime))
    const interval = setInterval(
      () => setSessionTime(formatSessionTime(startTime)),
      1000
    )
    return () => clearInterval(interval)
  }, [startTime])

  // Run latency tests
  const runTests = useCallback(async () => {
    if (testing) return
    setTesting(true)
    const results = new Map<string, number | null>()

    const promises = latencyTargets.map(async (target) => {
      try {
        const { delay } = await fetchProxyDelay('GLOBAL', target.url, 5000)
        results.set(target.name, delay || null)
      } catch {
        results.set(target.name, null)
      }
    })

    await Promise.allSettled(promises)
    setLatencyResults(new Map(results))
    setTesting(false)
  }, [latencyTargets, testing])

  // Auto-run tests on mount
  useEffect(() => {
    runTests()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const serverEntries = Object.entries(proxyServers)

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overview-card">
      <div className="flex items-center gap-2 mb-3">
        <Wifi className="size-4" />
        <span className="text-sm font-medium">Информация о сети</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left column: IP, geo, system, proxy servers */}
        <div className="space-y-0.5">
          {(backendAvailable || netData?.ip) && (
            <InfoRow
              icon={Globe}
              label="Внешний IP"
              value={
                netData?.ip && /^[\d.]+$|^[0-9a-fA-F:]+$/.test(netData.ip)
                  ? netData.ip
                  : 'Не определён'
              }
            />
          )}
          {netData?.info?.country && (
            <InfoRow
              icon={MapPin}
              label="Расположение"
              value={
                netData.info.city
                  ? `${netData.info.city}, ${netData.info.country}`
                  : netData.info.country
              }
            />
          )}
          {netData?.info?.isp && (
            <InfoRow icon={Building2} label="Провайдер" value={netData.info.isp} />
          )}
          {netData?.uptime != null && (
            <InfoRow
              icon={Clock}
              label="Аптайм системы"
              value={formatUptime(netData.uptime)}
            />
          )}
          <InfoRow icon={Clock} label="Сессия" value={sessionTime} />
          <InfoRow icon={Activity} label="Подключения" value={String(activeConnections)} />
          <InfoRow
            icon={ArrowDownUp}
            label="Всего трафика"
            value={formatBytes(downloadTotal + uploadTotal)}
          />

          {/* Proxy servers list */}
          {serverEntries.length > 0 && (
            <div className="pt-2 mt-1 border-t border-border/50">
              <div className="flex items-center gap-2 py-1 px-1">
                <Server className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Серверы прокси
                </span>
              </div>
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                {serverEntries.map(([name, addr]) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 py-1 px-1 rounded-md transition-colors duration-200 hover:bg-accent/50 group/srv"
                  >
                    <ProxyFlag name={name} className="w-4 h-3" />
                    <span className="text-sm truncate flex-1">{name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums font-mono transition-colors duration-200 group-hover/srv:text-foreground">
                      {addr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Latency tests */}
        <div>
          <div className="flex items-center gap-2 py-1 px-1 mb-1">
            <Zap className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Тесты задержки
            </span>
            <div className="ml-auto flex gap-1">
              <button
                onClick={runTests}
                disabled={testing}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Запустить тесты"
              >
                <RotateCw className={`size-3.5 ${testing ? 'animate-spin' : ''}`} />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Настройки целей"
                  >
                    <Settings className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <div className="text-sm font-medium mb-2">Цели тестирования</div>
                  <LatencyTargetsSettings />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-0.5">
            {latencyTargets.map((target) => {
              const result = latencyResults.get(target.name)
              const hasResult = latencyResults.has(target.name)
              return (
                <div
                  key={target.name}
                  className="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md transition-colors duration-200 hover:bg-accent/50"
                >
                  {faviconUrl(target.url) && (
                    <img
                      src={faviconUrl(target.url)!}
                      alt=""
                      className="size-4 shrink-0 rounded-sm"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                    />
                  )}
                  <span className="text-sm truncate flex-1">{target.name}</span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      !hasResult
                        ? 'text-muted-foreground'
                        : delayColor(result)
                    }`}
                  >
                    {testing && !hasResult
                      ? '...'
                      : hasResult
                        ? formatDelay(result ?? 0)
                        : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {latencyTargets.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Нет целей для тестирования
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
