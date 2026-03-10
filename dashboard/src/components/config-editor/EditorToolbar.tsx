/**
 * Editor toolbar: tabs on the left, action buttons + validation badge on the right.
 *
 * 4 tabs: config.yaml, ip_exclude, port_exclude, port_proxying.
 * Active tab highlighted with bg-muted. Dirty tabs show an orange dot.
 * Buttons: Format (YAML only), Save, Apply.
 * Keyboard shortcuts: Ctrl+1..4 switch tabs (with dirty check).
 */

import { useState, useEffect, useCallback } from 'react'
import { Wand2, Save, Play, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import yaml from 'js-yaml'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ApplyConfirmDialog } from '@/components/config-editor/ApplyConfirmDialog'
import { TabSwitchDialog } from '@/components/config-editor/TabSwitchDialog'
import {
  useConfigEditorStore,
  type TabId,
} from '@/stores/config-editor'
import { saveConfig, saveXkeenFile } from '@/lib/config-api'

const TAB_LABELS: Record<TabId, string> = {
  config: 'config.yaml',
  ip_exclude: 'ip_exclude',
  port_exclude: 'port_exclude',
  port_proxying: 'port_proxying',
}

const TAB_ORDER: TabId[] = ['config', 'ip_exclude', 'port_exclude', 'port_proxying']

interface EditorToolbarProps {
  onApplyConfirmed: () => Promise<void>
}

export function EditorToolbar({ onApplyConfirmed }: EditorToolbarProps) {
  const activeTab = useConfigEditorStore((s) => s.activeTab)
  const tabs = useConfigEditorStore((s) => s.tabs)
  const setActiveTab = useConfigEditorStore((s) => s.setActiveTab)
  const setContent = useConfigEditorStore((s) => s.setContent)
  const markSaved = useConfigEditorStore((s) => s.markSaved)

  const [pendingTab, setPendingTab] = useState<TabId | null>(null)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [formatLoading, setFormatLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)

  const currentTabState = tabs[activeTab]
  const isYaml = currentTabState.language === 'yaml'
  const validation = currentTabState.validation

  // --- Tab switching with dirty check ---

  const switchToTab = useCallback(
    (targetTab: TabId) => {
      if (targetTab === activeTab) return
      if (tabs[activeTab].dirty) {
        setPendingTab(targetTab)
      } else {
        setActiveTab(targetTab)
      }
    },
    [activeTab, tabs, setActiveTab]
  )

  // TabSwitchDialog handlers

  const handleSaveAndSwitch = useCallback(async () => {
    try {
      const content = tabs[activeTab].current
      if (activeTab === 'config') {
        await saveConfig(content)
      } else {
        await saveXkeenFile(activeTab, content)
      }
      markSaved(activeTab)
      toast.success('Сохранено')
    } catch (err) {
      toast.error(
        `Ошибка сохранения: ${err instanceof Error ? err.message : String(err)}`
      )
      setPendingTab(null)
      return
    }

    if (pendingTab) {
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
  }, [activeTab, tabs, pendingTab, markSaved, setActiveTab])

  const handleDiscardAndSwitch = useCallback(() => {
    // Reset current content to original
    setContent(activeTab, tabs[activeTab].original)

    if (pendingTab) {
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
  }, [activeTab, tabs, pendingTab, setContent, setActiveTab])

  const handleStay = useCallback(() => {
    setPendingTab(null)
  }, [])

  // --- Action buttons ---

  const handleFormat = useCallback(() => {
    if (!isYaml) return

    const content = currentTabState.current
    setFormatLoading(true)

    try {
      const parsed = yaml.load(content)
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      })
      toast.warning('Форматирование удалит комментарии')
      setContent(activeTab, formatted)
    } catch {
      toast.error('Невозможно отформатировать: невалидный YAML')
    } finally {
      setFormatLoading(false)
    }
  }, [isYaml, currentTabState.current, activeTab, setContent])

  const handleSave = useCallback(async () => {
    setSaveLoading(true)

    if (isYaml && !validation.valid) {
      toast.warning('YAML содержит ошибки')
    }

    try {
      const content = currentTabState.current
      if (activeTab === 'config') {
        await saveConfig(content)
      } else {
        await saveXkeenFile(activeTab, content)
      }
      markSaved(activeTab)
      toast.success('Сохранено')
    } catch (err) {
      toast.error(
        `Ошибка сохранения: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setSaveLoading(false)
    }
  }, [activeTab, currentTabState.current, isYaml, validation.valid, markSaved])

  const handleApplyConfirm = useCallback(async () => {
    setApplyDialogOpen(false)
    setApplyLoading(true)
    try {
      await onApplyConfirmed()
    } finally {
      setApplyLoading(false)
    }
  }, [onApplyConfirmed])

  // --- Keyboard shortcuts: Ctrl+1..4 ---

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        const index = Number(e.key) - 1
        switchToTab(TAB_ORDER[index])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [switchToTab])

  return (
    <>
      <div className="@container flex items-center px-2 h-10 shrink-0 border-b border-border/50">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          {TAB_ORDER.map((tabId) => {
            const isActive = tabId === activeTab
            const isDirty = tabs[tabId].dirty

            return (
              <button
                key={tabId}
                onClick={() => switchToTab(tabId)}
                className={`
                  relative flex items-center gap-1 px-2 @md:px-3 py-1.5 text-xs font-medium
                  rounded-t-md transition-colors min-w-0
                  ${isActive
                    ? 'bg-muted text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                `}
              >
                <span className="truncate">{TAB_LABELS[tabId]}</span>
                {isDirty && (
                  <span className="size-1.5 rounded-full bg-orange-400 shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* Validation badge + Action buttons */}
        <div className="flex items-center gap-1 @md:gap-2 shrink-0">
          {/* Validation indicator (yaml only) */}
          {isYaml && (
            validation.valid ? (
              <span className="flex items-center gap-1 text-xs text-green-500" title="YAML OK">
                <CheckCircle2 className="size-3.5" />
                <span className="hidden @lg:inline">YAML OK</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive" title={`Ошибка: строка ${validation.error?.line ?? '?'}`}>
                <AlertTriangle className="size-3.5" />
                <span className="hidden @md:inline">Строка {validation.error?.line ?? '?'}</span>
              </span>
            )
          )}

          {/* Format */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!isYaml || formatLoading}
            onClick={handleFormat}
            title="Форматировать YAML"
          >
            {formatLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wand2 className="size-3.5" />
            )}
          </Button>

          {/* Save */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 !px-2 @md:!px-3 gap-1.5 text-xs"
            disabled={saveLoading}
            onClick={handleSave}
            title="Сохранить на сервер (Ctrl+S)"
          >
            {saveLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span className="hidden @lg:inline leading-none">Сохранить</span>
          </Button>

          {/* Apply */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 !px-2 @md:!px-3 gap-1.5 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
            disabled={applyLoading}
            onClick={() => setApplyDialogOpen(true)}
            title="Сохранить и перезапустить mihomo"
          >
            {applyLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            <span className="hidden @lg:inline leading-none">Применить</span>
          </Button>
        </div>
      </div>

      {/* Apply confirmation dialog */}
      <ApplyConfirmDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        onConfirm={handleApplyConfirm}
        hasYamlError={isYaml && !validation.valid}
      />

      {/* Tab switch dialog (dirty tab) */}
      <TabSwitchDialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTab(null)
        }}
        currentTabName={TAB_LABELS[activeTab]}
        onSaveAndSwitch={handleSaveAndSwitch}
        onDiscardAndSwitch={handleDiscardAndSwitch}
        onStay={handleStay}
      />
    </>
  )
}
