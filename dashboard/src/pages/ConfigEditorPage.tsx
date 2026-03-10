/**
 * Config editor page -- full assembly with resizable layout.
 *
 * VS Code-style layout: EditorToolbar on top, Monaco editor in the
 * upper resizable panel, log panel in the lower panel.
 * Apply workflow: optional diff preview -> start log stream -> save -> restart.
 * Navigation guard warns about unsaved changes on page leave.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

import { useHealthCheck, isHealthy } from '@/hooks/useHealthCheck'
import { SetupGuide } from '@/components/shared/SetupGuide'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Card, CardContent } from '@/components/ui/card'
import { ConfigEditor } from '@/components/config-editor/ConfigEditor'
import { EditorToolbar } from '@/components/config-editor/EditorToolbar'
import { EditorLogPanel } from '@/components/config-editor/EditorLogPanel'
import { DiffPreview } from '@/components/config-editor/DiffPreview'
import { useConfigEditorStore } from '@/stores/config-editor'
import { useSettingsStore } from '@/stores/settings'
import { saveConfig, saveXkeenFile, serviceAction } from '@/lib/config-api'

export default function ConfigEditorPage() {
  const health = useHealthCheck({ requireConfigApi: true })

  const [diffOpen, setDiffOpen] = useState(false)

  const activeTab = useConfigEditorStore((s) => s.activeTab)
  const tabs = useConfigEditorStore((s) => s.tabs)
  const markSaved = useConfigEditorStore((s) => s.markSaved)
  const hasDirtyTabs = useConfigEditorStore((s) => s.hasDirtyTabs)
  const showDiffBeforeApply = useSettingsStore((s) => s.showDiffBeforeApply)

  // --- Navigation guard ---
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirtyTabs()) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasDirtyTabs])

  // --- Core Apply logic (called after all confirmations) ---
  const executeApply = useCallback(async () => {
    try {
      const tab = useConfigEditorStore.getState().activeTab
      const content = useConfigEditorStore.getState().tabs[tab].current

      if (tab === 'config') {
        await saveConfig(content)
      } else {
        await saveXkeenFile(tab, content)
      }
      markSaved(tab)

      await serviceAction('restart')

      toast.success('Конфиг применён, xkeen перезапускается')
    } catch (err) {
      toast.error(
        `Ошибка: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }, [markSaved])

  // --- Apply workflow entry point (from EditorToolbar) ---
  const handleApplyConfirmed = useCallback(async () => {
    if (showDiffBeforeApply) {
      setDiffOpen(true)
    } else {
      await executeApply()
    }
  }, [showDiffBeforeApply, executeApply])

  // --- Diff preview confirm ---
  const handleDiffConfirmApply = useCallback(async () => {
    setDiffOpen(false)
    await executeApply()
  }, [executeApply])

  // --- Save handler for ConfigEditor (Ctrl+S) ---
  const handleSave = useCallback(async () => {
    const tab = useConfigEditorStore.getState().activeTab
    const tabState = useConfigEditorStore.getState().tabs[tab]

    if (tabState.language === 'yaml' && !tabState.validation.valid) {
      toast.warning('YAML содержит ошибки')
    }

    try {
      if (tab === 'config') {
        await saveConfig(tabState.current)
      } else {
        await saveXkeenFile(tab, tabState.current)
      }
      markSaved(tab)
      toast.success('Сохранено')
    } catch (err) {
      toast.error(
        `Ошибка сохранения: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }, [markSaved])

  // Current tab state for diff preview
  const currentTab = tabs[activeTab]

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

  return (
    <div className="flex flex-col h-full gap-2">
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        {/* Editor panel */}
        <ResizablePanel defaultSize={70} minSize={30}>
          <div className="h-full pb-1">
            <Card className="flex flex-col flex-1 h-full w-full gap-0 py-0 overflow-hidden">
              <EditorToolbar onApplyConfirmed={handleApplyConfirmed} />
              <CardContent className="flex flex-col flex-1 min-h-0 p-0 overflow-hidden">
                <ConfigEditor onSave={handleSave} />
              </CardContent>
            </Card>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-transparent" />

        {/* Log panel */}
        <ResizablePanel defaultSize={30} minSize={10}>
          <div className="h-full pt-1">
            <Card className="flex flex-col flex-1 h-full w-full gap-0 py-0 overflow-hidden">
              <EditorLogPanel />
            </Card>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Diff preview dialog */}
      {diffOpen && (
        <DiffPreview
          open={diffOpen}
          onOpenChange={setDiffOpen}
          original={currentTab.original}
          modified={currentTab.current}
          language={currentTab.language}
          onConfirmApply={handleDiffConfirmApply}
        />
      )}
    </div>
  )
}
