/**
 * Rules page -- visual rules editor with group cards.
 *
 * Loads config on mount, displays rules as sortable cards
 * grouped by consecutive target proxy-groups.
 */

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react'
import { Search, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useRulesEditorStore } from '@/stores/rules-editor'
import { fetchConfig, saveConfig } from '@/lib/config-api'
import { RulesToolbar } from '@/components/rules/RulesToolbar'
import { RulesList } from '@/components/rules/RuleBlockList'
import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { SetupGuide } from '@/components/shared/SetupGuide'

export default function RulesPage() {
  const health = useHealthCheck({ requireConfigApi: true })

  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  const blocks = useRulesEditorStore((s) => s.blocks)
  const loading = useRulesEditorStore((s) => s.loading)
  const error = useRulesEditorStore((s) => s.error)
  const proxyGroups = useRulesEditorStore((s) => s.proxyGroups)

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

  // Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useRulesEditorStore.temporal.getState().undo()
        useRulesEditorStore.getState().syncAfterUndoRedo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        useRulesEditorStore.temporal.getState().redo()
        useRulesEditorStore.getState().syncAfterUndoRedo()
      } else if (e.key === 's') {
        e.preventDefault()
        const state = useRulesEditorStore.getState()
        if (!state.dirty) return
        const yaml = state.serialize()
        saveConfig(yaml).then(() => {
          useRulesEditorStore.getState().markSaved()
          toast.success('Конфигурация сохранена')
        }).catch((err) => {
          toast.error('Ошибка сохранения: ' + (err instanceof Error ? err.message : String(err)))
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Navigation guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useRulesEditorStore.getState().dirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Filter blocks by search -- show only blocks containing matching rules,
  // with only the matching rules inside them
  const filteredBlocks = useMemo(() => {
    if (!deferredSearch) return blocks

    const q = deferredSearch.toLowerCase()
    const result = []
    for (const block of blocks) {
      const matchingRules = block.rules.filter((rule) =>
        rule.type.toLowerCase().includes(q) ||
        rule.value.toLowerCase().includes(q) ||
        rule.target.toLowerCase().includes(q)
      )
      if (matchingRules.length > 0) {
        result.push({ ...block, rules: matchingRules })
      }
    }
    return result
  }, [blocks, deferredSearch])

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
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[80px] rounded-xl" />
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
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
      <RulesToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {filteredBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Правила не найдены</p>
          {searchQuery && (
            <p className="text-sm mt-1">
              Попробуйте изменить поисковый запрос
            </p>
          )}
        </div>
      ) : (
        <RulesList
          blocks={filteredBlocks}
          proxyGroups={proxyGroups}
        />
      )}
    </div>
  )
}
