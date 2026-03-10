import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useProxiesStore } from '@/stores/proxies'
import { useSettingsStore } from '@/stores/settings'
import { ProxiesToolbar } from '@/components/proxies/ProxiesToolbar'
import { ProxyGroupCard } from '@/components/proxies/ProxyGroupCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { SetupGuide } from '@/components/shared/SetupGuide'

export default function ProxiesPage() {
  const health = useHealthCheck({ requireMihomo: true })

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const groupNames = useProxiesStore((s) => s.groupNames)
  const proxyMap = useProxiesStore((s) => s.proxyMap)
  const loading = useProxiesStore((s) => s.loading)

  const gridColumns = useSettingsStore((s) => s.proxiesGridColumns)
  const density = useSettingsStore((s) => s.proxiesDensity)
  const sort = useSettingsStore((s) => s.proxiesSort)
  const typeStyle = useSettingsStore((s) => s.proxiesTypeStyle)


  // Responsive column count: on small screens always 1, md = up to 2, lg = up to 3
  const isMd = useMediaQuery('(min-width: 768px)')
  const isLg = useMediaQuery('(min-width: 1024px)')

  const effectiveCols = useMemo(() => {
    if (gridColumns === 1) return 1
    if (gridColumns === 2) return isMd ? 2 : 1
    // gridColumns === 3
    if (isLg) return 3
    if (isMd) return 2
    return 1
  }, [gridColumns, isMd, isLg])

  // Fetch proxies on mount
  useEffect(() => {
    useProxiesStore.getState().fetchAllProxies()
  }, [])

  // Filter groups
  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return groupNames.filter((name) => {
      const group = proxyMap[name]
      if (!group) return false

      // Type filter
      if (typeFilter !== 'all' && group.type !== typeFilter) return false

      // Search filter
      if (query) {
        const nameMatch = name.toLowerCase().includes(query)
        const proxyMatch = group.all?.some((p) =>
          p.toLowerCase().includes(query)
        )
        if (!nameMatch && !proxyMatch) return false
      }

      return true
    })
  }, [groupNames, proxyMap, typeFilter, searchQuery])

  // Masonry: distribute items round-robin into columns (left-to-right order, no gaps)
  const columns = useMemo(() => {
    const cols: string[][] = Array.from({ length: effectiveCols }, () => [])
    filteredGroups.forEach((name, i) => {
      cols[i % effectiveCols].push(name)
    })
    return cols
  }, [filteredGroups, effectiveCols])

  if (!isHealthy(health)) {
    return (
      <SetupGuide
        mihomoOk={health.mihomoOk}
        configApiOk={health.configApiOk}
        loading={health.loading}
        onRetry={health.retry}
      />
    )
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1 min-w-0" />
          <Skeleton className="h-9 w-[100px] shrink-0" />
          <Skeleton className="h-9 w-9 shrink-0" />
          <Skeleton className="h-9 w-9 shrink-0" />
        </div>
        <div className="flex gap-4">
          {Array.from({ length: effectiveCols }).map((_, col) => (
            <div key={col} className="flex-1 flex flex-col gap-4">
              {Array.from({ length: Math.ceil(6 / effectiveCols) }).map((_, i) => (
                <Skeleton key={i} className="h-[100px] rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ProxiesToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Группы не найдены</p>
          {searchQuery && (
            <p className="text-sm mt-1">
              Попробуйте изменить поисковый запрос
            </p>
          )}
        </div>
      ) : (
        <div className="flex gap-4">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex-1 flex flex-col gap-4 min-w-0">
              {col.map((name) => (
                <ProxyGroupCard
                  key={name}
                  groupName={name}
                  density={density}
                  typeStyle={typeStyle}
                  sortBy={sort}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
