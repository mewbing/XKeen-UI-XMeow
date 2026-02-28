/**
 * Monaco Editor wrapper with YAML validation and keyboard shortcuts.
 *
 * Renders Monaco Editor for the active tab, switches language between
 * 'yaml' (config) and 'plaintext' (xkeen files). Validates YAML in
 * real-time (debounced) with inline error markers. Loads tab content
 * lazily from the server on first access.
 */

import { useEffect, useRef, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import yaml from 'js-yaml'
import { toast } from 'sonner'

import { Skeleton } from '@/components/ui/skeleton'
import {
  useConfigEditorStore,
  type TabId,
} from '@/stores/config-editor'
import { fetchConfig, fetchXkeenFile } from '@/lib/config-api'

interface ConfigEditorProps {
  onSave: () => void
}

export function ConfigEditor({ onSave }: ConfigEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)

  // Keep onSave ref current to avoid stale closure in Monaco command
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const activeTab = useConfigEditorStore((s) => s.activeTab)
  const tabState = useConfigEditorStore((s) => s.tabs[s.activeTab])
  const setContent = useConfigEditorStore((s) => s.setContent)
  const setValidation = useConfigEditorStore((s) => s.setValidation)
  const setOriginal = useConfigEditorStore((s) => s.setOriginal)
  const setLoading = useConfigEditorStore((s) => s.setLoading)

  // Track which tabs have been loaded to avoid refetching
  const loadedTabsRef = useRef<Set<TabId>>(new Set())

  // Load tab content from server
  const loadTabContent = useCallback(
    async (tabId: TabId) => {
      if (loadedTabsRef.current.has(tabId)) return

      setLoading(tabId, true)
      try {
        let content: string
        if (tabId === 'config') {
          const data = await fetchConfig()
          content = data.content
        } else {
          const data = await fetchXkeenFile(tabId)
          content = data.content
        }
        setOriginal(tabId, content)
        loadedTabsRef.current.add(tabId)
      } catch (err) {
        toast.error(
          `Ошибка загрузки ${tabId}: ${err instanceof Error ? err.message : String(err)}`
        )
      } finally {
        setLoading(tabId, false)
      }
    },
    [setOriginal, setLoading]
  )

  // Load active tab content on mount and tab switch
  useEffect(() => {
    loadTabContent(activeTab)
  }, [activeTab, loadTabContent])

  // YAML validation (debounced)
  const runValidation = useCallback(
    (content: string, tab: TabId) => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }

      const tabLanguage = useConfigEditorStore.getState().tabs[tab].language

      if (tabLanguage !== 'yaml') {
        setValidation(tab, { valid: true })
        return
      }

      validationTimerRef.current = setTimeout(() => {
        const monaco = monacoRef.current
        const ed = editorRef.current

        try {
          yaml.load(content)

          // Clear markers
          if (monaco && ed) {
            const model = ed.getModel()
            if (model) {
              monaco.editor.setModelMarkers(model, 'yaml-validation', [])
            }
          }
          setValidation(tab, { valid: true })
        } catch (e) {
          if (e instanceof yaml.YAMLException && e.mark) {
            const line = e.mark.line + 1
            const column = e.mark.column + 1

            // Set error marker
            if (monaco && ed) {
              const model = ed.getModel()
              if (model) {
                const marker: editor.IMarkerData = {
                  severity: monaco.MarkerSeverity.Error,
                  message: e.reason || e.message,
                  startLineNumber: line,
                  startColumn: column,
                  endLineNumber: line,
                  endColumn: column + 1,
                }
                monaco.editor.setModelMarkers(model, 'yaml-validation', [marker])
              }
            }

            setValidation(tab, {
              valid: false,
              error: {
                message: e.reason || e.message,
                line,
                column,
              },
            })
          } else {
            setValidation(tab, {
              valid: false,
              error: {
                message: String(e),
                line: 0,
                column: 0,
              },
            })
          }
        }
      }, 300)
    },
    [setValidation]
  )

  // Handle editor content change
  const handleChange = useCallback(
    (value: string | undefined) => {
      const content = value ?? ''
      setContent(activeTab, content)
      runValidation(content, activeTab)
    },
    [activeTab, setContent, runValidation]
  )

  // Run initial validation when tab content loads
  useEffect(() => {
    if (tabState.current && tabState.language === 'yaml' && monacoRef.current) {
      runValidation(tabState.current, activeTab)
    }
  }, [activeTab, tabState.current, tabState.language]) // eslint-disable-line react-hooks/exhaustive-deps

  // Monaco onMount handler
  const handleEditorMount = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = ed
      monacoRef.current = monaco

      // Register Ctrl+S shortcut
      ed.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          onSaveRef.current()
        }
      )

      // Run initial validation for current content
      const state = useConfigEditorStore.getState()
      const currentTab = state.activeTab
      const content = state.tabs[currentTab].current
      if (content && state.tabs[currentTab].language === 'yaml') {
        runValidation(content, currentTab)
      }
    },
    [runValidation]
  )

  // Cleanup validation timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
    }
  }, [])

  if (tabState.loading) {
    return (
      <div className="flex-1 min-h-0 p-4">
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0">
      <Editor
        height="100%"
        language={tabState.language}
        path={`file:///${activeTab}`}
        value={tabState.current}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
        loading={<Skeleton className="h-full w-full" />}
      />
    </div>
  )
}
