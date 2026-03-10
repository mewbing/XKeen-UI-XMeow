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
      { token: 'comment', foreground: '6b6990', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'string', foreground: 'c3e88d' },
      { token: 'number', foreground: 'f78c6c' },
      { token: 'type', foreground: 'ffcb6b' },
      { token: 'tag', foreground: 'f07178' },
      { token: 'attribute.name', foreground: 'c792ea' },
      { token: 'attribute.value', foreground: 'c3e88d' },
      { token: 'delimiter', foreground: '89ddff' },
    ],
    colors: {
      'editor.background': '#24233a',
      'editor.foreground': '#e6e5f0',
      'editorGutter.background': '#24233a',
      'editor.lineHighlightBackground': '#2c2a4620',
      'editor.lineHighlightBorder': '#2c2a4640',
      'editor.selectionBackground': '#7567e035',
      'editor.inactiveSelectionBackground': '#7567e018',
      'editor.wordHighlightBackground': '#7567e020',
      'editorCursor.foreground': '#a78bfa',
      'editorLineNumber.foreground': '#5a5878',
      'editorLineNumber.activeForeground': '#9e9cb8',
      'editorWidget.background': '#24233a',
      'editorWidget.border': '#3a3860',
      'editorBracketMatch.background': '#7567e025',
      'editorBracketMatch.border': '#7567e050',
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
