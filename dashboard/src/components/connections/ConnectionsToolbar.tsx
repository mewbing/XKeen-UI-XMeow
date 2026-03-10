import { Search, Pause, Play, X, Link, Unlink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useConnectionsStore } from '@/stores/connections'
import { useSettingsStore } from '@/stores/settings'
import { ColumnSelector } from './ColumnSelector'

export function ConnectionsToolbar() {
  const splitMode = useSettingsStore((s) => s.splitMode)
  const syncScroll = useSettingsStore((s) => s.syncScroll)
  const toggleSyncScroll = useSettingsStore((s) => s.toggleSyncScroll)
  const searchQuery = useConnectionsStore((s) => s.searchQuery)
  const setSearchQuery = useConnectionsStore((s) => s.setSearchQuery)
  const networkFilter = useConnectionsStore((s) => s.networkFilter)
  const setNetworkFilter = useConnectionsStore((s) => s.setNetworkFilter)
  const ruleFilter = useConnectionsStore((s) => s.ruleFilter)
  const setRuleFilter = useConnectionsStore((s) => s.setRuleFilter)
  const chainFilter = useConnectionsStore((s) => s.chainFilter)
  const setChainFilter = useConnectionsStore((s) => s.setChainFilter)
  const paused = useConnectionsStore((s) => s.paused)
  const setPaused = useConnectionsStore((s) => s.setPaused)
  const connections = useConnectionsStore((s) => s.connections)
  const filteredConnections = useConnectionsStore((s) => s.filteredConnections)
  const uniqueRules = useConnectionsStore((s) => s.uniqueRules)
  const uniqueChains = useConnectionsStore((s) => s.uniqueChains)
  const closeAllConnections = useConnectionsStore((s) => s.closeAllConnections)

  const filtered = filteredConnections()
  const rules = uniqueRules()
  const chains = uniqueChains()

  return (
    <div className="space-y-1.5 p-2 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      {/* Row 1: Search + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>

        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {filtered.length} / {connections.length}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setPaused(!paused)}
          title={paused ? 'Возобновить' : 'Пауза'}
          className={paused ? 'animate-pulse' : ''}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </Button>

        <ColumnSelector />

        {splitMode !== 'none' && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleSyncScroll}
            title={syncScroll ? 'Раздельная прокрутка' : 'Синхронная прокрутка'}
            className={syncScroll ? 'border-green-500/50 bg-green-500/10' : ''}
          >
            {syncScroll
              ? <Link className="size-3.5 text-green-600 dark:text-green-400" />
              : <Unlink className="size-3.5 text-muted-foreground" />}
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon-sm" title="Закрыть все">
              <X className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Закрыть все подключения?</AlertDialogTitle>
              <AlertDialogDescription>
                Все активные подключения будут закрыты. Новые подключения появятся автоматически.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => closeAllConnections()}
              >
                Закрыть все
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Row 2: Filters */}
      <div className="flex items-center gap-2">
        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger className="h-7 w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="tcp">TCP</SelectItem>
            <SelectItem value="udp">UDP</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ruleFilter} onValueChange={setRuleFilter}>
          <SelectTrigger className="h-7 flex-1 min-w-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все правила</SelectItem>
            {rules.map((rule) => (
              <SelectItem key={rule} value={rule}>
                {rule}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={chainFilter} onValueChange={setChainFilter}>
          <SelectTrigger className="h-7 flex-1 min-w-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все прокси</SelectItem>
            {chains.map((chain) => (
              <SelectItem key={chain} value={chain}>
                {chain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
