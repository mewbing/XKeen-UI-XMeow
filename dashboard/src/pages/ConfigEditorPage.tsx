/**
 * Config editor page -- full assembly with resizable layout.
 *
 * VS Code-style layout: EditorToolbar on top, Monaco editor in the
 * upper resizable panel, log panel in the lower collapsible panel.
 * Apply workflow: optional diff preview -> start log stream -> save -> restart.
 * Navigation guard warns about unsaved changes on page leave.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { ConfigEditor } from '@/components/config-editor/ConfigEditor'
import { EditorToolbar } from '@/components/config-editor/EditorToolbar'
import { EditorLogPanel } from '@/components/config-editor/EditorLogPanel'
import { DiffPreview } from '@/components/config-editor/DiffPreview'
import { useConfigEditorStore } from '@/stores/config-editor'
import { useSettingsStore } from '@/stores/settings'
import { saveConfig, saveXkeenFile } from '@/lib/config-api'
import { restartMihomo } from '@/lib/mihomo-api'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function ConfigEditorPage() {
  const logPanelRef = useRef<PanelImperativeHandle | null>(null)
  const [logPanelCollapsed, setLogPanelCollapsed] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)

  const activeTab = useConfigEditorStore((s) => s.activeTab)
  const tabs = useConfigEditorStore((s) => s.tabs)
  const markSaved = useConfigEditorStore((s) => s.markSaved)
  const startLogStream = useConfigEditorStore((s) => s.startLogStream)
  const stopLogStream = useConfigEditorStore((s) => s.stopLogStream)
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

  // --- Log panel collapse handling ---
  const handleToggleCollapse = useCallback(() => {
    const panel = logPanelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
      // Stop streaming when collapsing
      stopLogStream()
    }
  }, [stopLogStream])

  const handleLogPanelResize = useCallback(
    (panelSize: PanelSize) => {
      const collapsed = panelSize.asPercentage === 0
      setLogPanelCollapsed(collapsed)
      if (collapsed) {
        stopLogStream()
      }
    },
    [stopLogStream]
  )

  // --- Core Apply logic (called after all confirmations) ---
  const executeApply = useCallback(async () => {
    try {
      // 1. Start log streaming (EditorLogPanel will react and connect WS)
      startLogStream()

      // 2. Expand log panel if collapsed
      if (logPanelRef.current?.isCollapsed()) {
        logPanelRef.current.expand()
      }

      // 3. Wait for WS to connect
      await sleep(500)

      // 4. Save current tab content
      const tab = useConfigEditorStore.getState().activeTab
      const content = useConfigEditorStore.getState().tabs[tab].current

      if (tab === 'config') {
        await saveConfig(content)
      } else {
        await saveXkeenFile(tab, content)
      }
      markSaved(tab)

      // 5. Restart mihomo
      await restartMihomo()

      toast.success('Конфиг применён, mihomo перезапускается')
    } catch (err) {
      stopLogStream()
      toast.error(
        `Ошибка Apply: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }, [startLogStream, markSaved, stopLogStream])

  // --- Apply workflow entry point (from EditorToolbar) ---
  const handleApplyConfirmed = useCallback(async () => {
    if (showDiffBeforeApply) {
      // Show diff preview first; actual apply happens in onConfirmApply
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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar: tabs + action buttons */}
      <EditorToolbar onApplyConfirmed={handleApplyConfirmed} />

      {/* Resizable layout: editor on top, logs on bottom */}
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        {/* Editor panel */}
        <ResizablePanel defaultSize={70} minSize={30}>
          <ConfigEditor onSave={handleSave} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Log panel (collapsible) */}
        <ResizablePanel
          defaultSize={30}
          minSize={5}
          collapsible
          collapsedSize={0}
          panelRef={logPanelRef}
          onResize={handleLogPanelResize}
        >
          <EditorLogPanel
            collapsed={logPanelCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Diff preview dialog */}
      <DiffPreview
        open={diffOpen}
        onOpenChange={setDiffOpen}
        original={currentTab.original}
        modified={currentTab.current}
        language={currentTab.language}
        onConfirmApply={handleDiffConfirmApply}
      />
    </div>
  )
}
