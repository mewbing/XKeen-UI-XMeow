import { useSyncExternalStore, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'

type ResolvedTheme = 'light' | 'dark'

/** MediaQuery singleton for system preference detection */
const mq =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function getSystemTheme(): ResolvedTheme {
  return mq?.matches ? 'dark' : 'light'
}

function subscribeToSystemTheme(callback: () => void) {
  mq?.addEventListener('change', callback)
  return () => mq?.removeEventListener('change', callback)
}

/**
 * Returns the effective theme ('light' | 'dark') after resolving 'system'.
 * Reacts to both settings changes and OS preference changes.
 */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useSettingsStore((s) => s.theme)
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme)

  if (theme === 'system') return systemTheme
  return theme
}

/**
 * Returns the resolved theme as a Monaco Editor theme string.
 */
export function useMonacoTheme(): string {
  const resolved = useResolvedTheme()
  return resolved === 'dark' ? 'antigravity-dark' : 'light'
}

/**
 * Register the custom "antigravity-dark" Monaco theme.
 * Pass as `beforeMount` prop to Monaco Editor.
 */
export function registerMonacoTheme(monaco: { editor: { defineTheme: (name: string, data: unknown) => void } }) {
  monaco.editor.defineTheme('antigravity-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: 'f78c6c' },
      { token: 'type', foreground: '82aaff' },
    ],
    colors: {
      'editor.background': '#0c0a1a',
      'editor.foreground': '#e2e0f0',
      'editor.lineHighlightBackground': '#1a1730',
      'editor.selectionBackground': '#3d3566',
      'editorCursor.foreground': '#a78bfa',
      'editorLineNumber.foreground': '#4a4570',
      'editorLineNumber.activeForeground': '#a78bfa',
    },
  })
}

/**
 * Applies the `.dark` class to `<html>` element.
 * Call this once in App.tsx.
 */
export function useApplyThemeClass() {
  const resolved = useResolvedTheme()

  const apply = useCallback(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  return { resolved, apply }
}
