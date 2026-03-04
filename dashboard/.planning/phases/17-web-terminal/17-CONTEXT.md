# Phase 17: Web Terminal - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Web terminal with SSH backend (Go) and xterm.js frontend for remote shell access to the router. The terminal is accessible as a modal overlay from any page in the dashboard — NOT a separate page/route. The Go backend establishes SSH connections to the router (or other configurable hosts) and bridges I/O via WebSocket to the browser's xterm.js instance.

</domain>

<decisions>
## Implementation Decisions

### Terminal UI / Layout
- Modal dialog overlay, accessible from ANY page (not a sidebar menu item, not a separate route)
- Icon button in the header (left of the theme toggle "lamp" button) + keyboard shortcut Ctrl+` (like VS Code)
- Session persists when modal is closed — reopening restores the active session
- xterm.js themed to match Antigravity palette (same tones as Config Editor, Logs, and other pages)
- Auto-resize via xterm.js FitAddon — terminal adapts to container size, sends cols/rows to backend for PTY resize

### Toolbar (above terminal)
- Extended toolbar (matches project convention — like LogsToolbar, ConnectionsToolbar):
  - Connect / Disconnect button with connection status indicator
  - Clear terminal buffer
  - Search in buffer (Ctrl+F shortcut, xterm.js SearchAddon)
  - Font size control (+/-)
  - Fullscreen toggle (expand modal to near-full viewport)

### Shell & SSH Connection
- SSH connection via `golang.org/x/crypto/ssh` — NOT direct PTY (os/exec + creack/pty)
- Shell auto-detect on the remote host: tries bash -> ash -> sh
- Configurable SSH host:port (default: localhost:22) stored in settings
- Credentials prompt on connect: login + password dialog before establishing SSH
  - Login saved to localStorage for convenience
  - Password NEVER saved — entered each time
- Single SSH session at a time (router has limited resources). Reopening reconnects to the existing session if still alive

### Security
- WS endpoint protected by the same Bearer token (mihomo secret) as all other API endpoints
- No additional authentication beyond SSH credentials + mihomo secret
- Inactivity timeout: 30 minutes — session closed if no input for 30 min (prevents zombie processes on router)

### Terminal Features
- Full copy/paste support: Ctrl+C copies selection, Ctrl+V pastes, right-click = paste (PuTTY-style). xterm.js handles this natively
- Search in scrollback buffer via SearchAddon (opened from toolbar or Ctrl+F)
- Scrollback buffer: 1000 lines
- Auto-reconnect on WS disconnect: show "Disconnected" status, attempt to reconnect. SSH session on server may still be alive within the 30-min timeout window

### Claude's Discretion
- Exact modal animation and sizing
- SSH host key verification strategy (accept all / TOFU / warn)
- WebSocket message protocol format (binary vs JSON envelope)
- Error state UI when SSH connection fails
- Search bar positioning within terminal area

</decisions>

<specifics>
## Specific Ideas

- "Terminal icon in header, left of the lamp button — quick access from any page"
- "Modal dialog, not a bottom panel — open it, type something, close and return to editing config or viewing logs"
- "Theme in the same tones as the rest of the dashboard — like the editor and logs pages"
- Toolbar should feel consistent with existing toolbars (LogsToolbar, ConnectionsToolbar, RulesToolbar)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useLogWebSocket` hook (src/hooks/useLogWebSocket.ts): Bidirectional WS protocol with ping/pong, reconnect, Strict Mode safety — can serve as reference for terminal WS hook
- `useMihomoWs` hook (src/hooks/use-mihomo-ws.ts): Generic WS with auto-reconnect pattern
- Go logwatch package (internal/logwatch/): Hub/client/watcher pattern for WS broadcasting — reference for terminal session management
- shadcn Dialog component (src/components/ui/dialog.tsx): Base for terminal modal
- Toolbar pattern: LogsToolbar, ConnectionsToolbar, RulesToolbar — consistent toolbar layout to follow
- Header component (src/components/layout/Header.tsx): Where terminal icon button will be placed

### Established Patterns
- Zustand stores for state management (no React Context)
- Individual selectors for minimal re-renders
- `cn()` for conditional Tailwind classes
- Bearer token auth via settings store (`mihomoSecret`)
- Toast notifications via `sonner` for errors/status
- Settings persisted to localStorage via `zustand/persist`

### Integration Points
- Header.tsx: Add terminal icon button (left of theme toggle)
- App.tsx or AppLayout.tsx: Mount terminal modal component (global, outside route tree)
- Settings store: Add SSH host/port/username preferences
- Go backend routes.go: New WS endpoint `/ws/terminal`
- Go backend: New `internal/terminal/` package for SSH client + session management

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-web-terminal*
*Context gathered: 2026-03-04*
