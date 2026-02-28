/**
 * Rules page -- full visual rules editor.
 *
 * Loads config on mount, displays rules as sortable block cards,
 * supports expand/collapse, search filtering, and 3 view modes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'
import { useRulesEditorStore } from '@/stores/rules-editor'
import { fetchConfig } from '@/lib/config-api'
import { RulesToolbar } from '@/components/rules/RulesToolbar'
import { RuleBlockList } from '@/components/rules/RuleBlockList'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { SetupGuide } from '@/components/shared/SetupGuide'

export default function RulesPage() {
  const health = useHealthCheck({ requireConfigApi: true })

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())

  const blocks = useRulesEditorStore((s) => s.blocks)
  const loading = useRulesEditorStore((s) => s.loading)
  const error = useRulesEditorStore((s) => s.error)
  const proxyGroups = useRulesEditorStore((s) => s.proxyGroups)

  const layout = useSettingsStore((s) => s.rulesLayout)
  const density = useSettingsStore((s) => s.rulesDensity)
  const newBlockMode = useSettingsStore((s) => s.rulesNewBlockMode)

  // Load config on mount
  const loadRules = useCallback(async () => {
    useRulesEditorStore.setState({ loading: true, error: null })
    try {
      const { content } = await fetchConfig()
      useRulesEditorStore.getState().loadRules(content)
    } catch (e) {
      useRulesEditorStore.setState({
        error: e instanceof Error ? e.message : 'Не удалось загрузить конфиг',
        loading: false,
      })
    }
  }, [])

  useEffect(() => {
    if (isHealthy(health)) {
      loadRules()
    }
  }, [health.loading, health.configApiOk]) // eslint-disable-line

  // Re-group when grouping mode changes
  const handleGroupingChange = useCallback(() => {
    const { originalYaml } = useRulesEditorStore.getState()
    if (originalYaml) {
      useRulesEditorStore.getState().loadRules(originalYaml)
    }
  }, [])

  // Toggle expand/collapse
  const handleToggleExpand = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) {
        next.delete(blockId)
      } else {
        next.add(blockId)
      }
      return next
    })
  }, [])

  // Filter blocks by search
  const filteredBlocks = useMemo(() => {
    if (!searchQuery) return blocks

    const q = searchQuery.toLowerCase()
    return blocks.filter((block) => {
      // Match block name
      if (block.name.toLowerCase().includes(q)) return true
      // Match target
      if (block.target.toLowerCase().includes(q)) return true
      // Match rule content
      return block.rules.some((rule) =>
        rule.type.toLowerCase().includes(q) ||
        rule.value.toLowerCase().includes(q) ||
        rule.target.toLowerCase().includes(q)
      )
    })
  }, [blocks, searchQuery])

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
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1 min-w-0" />
          <Skeleton className="h-9 w-[100px] shrink-0" />
          <Skeleton className="h-9 w-[100px] shrink-0" />
          <Skeleton className="h-9 w-[80px] shrink-0" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[60px] rounded-xl" />
          <Skeleton className="h-[60px] rounded-xl" />
          <Skeleton className="h-[60px] rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-12 mb-4 text-destructive opacity-50" />
        <p className="text-lg font-medium">Ошибка загрузки</p>
        <p className="text-sm mt-1 max-w-md text-center">{error}</p>
        <Button variant="outline" className="mt-4" onClick={loadRules}>
          <RefreshCw className="size-4" />
          Повторить
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <RulesToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onGroupingChange={handleGroupingChange}
      />

      {filteredBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Блоки не найдены</p>
          {searchQuery && (
            <p className="text-sm mt-1">
              Попробуйте изменить поисковый запрос
            </p>
          )}
        </div>
      ) : (
        <RuleBlockList
          blocks={filteredBlocks}
          density={density}
          layout={layout}
          expandedBlocks={expandedBlocks}
          onToggleExpand={handleToggleExpand}
          newBlockMode={newBlockMode}
          proxyGroups={proxyGroups}
        />
      )}
    </div>
  )
}
