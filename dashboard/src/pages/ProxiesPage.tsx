import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useProxiesStore } from '@/stores/proxies'
import { useSettingsStore } from '@/stores/settings'
import { ProxiesToolbar } from '@/components/proxies/ProxiesToolbar'
import { ProxyGroupCard } from '@/components/proxies/ProxyGroupCard'

const GRID_COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
}

export default function ProxiesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const groupNames = useProxiesStore((s) => s.groupNames)
  const proxyMap = useProxiesStore((s) => s.proxyMap)
  const loading = useProxiesStore((s) => s.loading)

  const gridColumns = useSettingsStore((s) => s.proxiesGridColumns)
  const density = useSettingsStore((s) => s.proxiesDensity)
  const sort = useSettingsStore((s) => s.proxiesSort)
  const typeStyle = useSettingsStore((s) => s.proxiesTypeStyle)
  const showAutoInfo = useSettingsStore((s) => s.proxiesShowAutoInfo)

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

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-[140px]" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-9 w-9" />
        </div>
        <div className={cn('grid gap-4', GRID_COLS_CLASS[gridColumns])}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
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
        <div className={cn('grid gap-4', GRID_COLS_CLASS[gridColumns])}>
          {filteredGroups.map((name) => (
            <ProxyGroupCard
              key={name}
              groupName={name}
              density={density}
              typeStyle={typeStyle}
              showAutoInfo={showAutoInfo}
              sortBy={sort}
            />
          ))}
        </div>
      )}
    </div>
  )
}
