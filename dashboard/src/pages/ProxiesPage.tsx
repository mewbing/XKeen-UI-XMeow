import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useProxiesStore } from '@/stores/proxies'
import { useSettingsStore } from '@/stores/settings'
import { ProxiesToolbar } from '@/components/proxies/ProxiesToolbar'
import { ProxyGroupCard } from '@/components/proxies/ProxyGroupCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'

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
        <div key={effectiveCols} className="flex gap-4 animate-in fade-in-0 duration-200">
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
