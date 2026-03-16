---
phase: 20-remote-management
plan: 05
subsystem: ui+api
tags: [context-switching, sidebar, routing, settings, remote-management]

# Dependency graph
requires:
  - phase: 20-remote-management
    plan: 04
    artifacts: [src/stores/remote.ts, src/pages/RemotePage.tsx]
---

## Summary

Context-aware API layer and UI integration for remote management. Created `useRemoteContext` hook that transparently switches all API calls between local and remote mode through SSH tunnel proxy. Added ContextSwitcher component in sidebar footer, Remote page route at `/remote`, and settings toggle for page visibility.

## Key Changes

### key-files
created:
  - src/hooks/useRemoteContext.ts — Hook returning context-aware API base URLs (local vs proxy)
  - src/components/remote/ContextSwitcher.tsx — Sidebar dropdown for switching between local and remote routers
modified:
  - src/lib/config-api.ts — Uses getContextBaseUrl() for context-aware routing
  - src/lib/mihomo-api.ts — Uses getContextBaseUrl() for mihomo API calls
  - src/components/layout/AppSidebar.tsx — Added Remote menu item and ContextSwitcher
  - src/stores/settings.ts — Added showRemotePage setting
  - src/pages/SettingsPage.tsx — Added remote management toggle in Interface section
  - src/App.tsx — Added /remote route

## Self-Check: PASSED

- [x] useApiBaseUrl hook returns correct URLs for local and remote mode
- [x] getContextBaseUrl works outside React (for store actions)
- [x] config-api.ts uses context-aware base URL
- [x] mihomo-api.ts uses context-aware base URL
- [x] ContextSwitcher renders in sidebar
- [x] Remote page route /remote accessible
- [x] Settings toggle controls page visibility

## Deviations

None significant.
