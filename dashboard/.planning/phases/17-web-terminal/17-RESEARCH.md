# Phase 17: Web Terminal - Research

**Researched:** 2026-03-04
**Domain:** SSH-to-WebSocket bridge (Go backend) + xterm.js terminal emulator (React frontend)
**Confidence:** HIGH

## Summary

Phase 17 adds a web-based SSH terminal to the XMeow Dashboard. The architecture is a classic SSH-to-WebSocket bridge: the Go backend establishes an SSH connection to the router (via `golang.org/x/crypto/ssh`), allocates a PTY, and bridges the SSH session I/O to the browser over a gorilla/websocket connection. The frontend renders the terminal using xterm.js with addons for fit, search, and web links.

The project already has a proven WebSocket pattern (`internal/logwatch/` + `internal/handler/ws_logs.go` + `useLogWebSocket` hook) that handles upgrade, client lifecycle, ping/pong keepalive, and reconnect. The terminal WebSocket will follow the same structural patterns but with a different message protocol -- binary data for terminal I/O, JSON for control messages (resize, connect, disconnect).

**Primary recommendation:** Use `@xterm/xterm` v5.5.0 (stable, scoped packages) with `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links`. Backend uses `golang.org/x/crypto/ssh` for SSH client with password auth. WebSocket protocol uses binary frames for terminal data and JSON text frames for control messages (resize, connect/disconnect).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Modal dialog overlay, accessible from ANY page (not a sidebar menu item, not a separate route)
- Icon button in header (left of the theme toggle "lamp" button) + keyboard shortcut Ctrl+` (like VS Code)
- Session persists when modal is closed -- reopening restores the active session
- xterm.js themed to match Antigravity palette (same tones as Config Editor, Logs, and other pages)
- Auto-resize via xterm.js FitAddon -- terminal adapts to container size, sends cols/rows to backend for PTY resize
- Extended toolbar (matches project convention -- like LogsToolbar, ConnectionsToolbar): Connect/Disconnect, Clear, Search (Ctrl+F), Font size +/-, Fullscreen toggle
- SSH connection via `golang.org/x/crypto/ssh` -- NOT direct PTY (os/exec + creack/pty)
- Shell auto-detect on remote host: tries bash -> ash -> sh
- Configurable SSH host:port (default: localhost:22) stored in settings
- Credentials prompt on connect: login + password dialog before establishing SSH. Login saved to localStorage. Password NEVER saved
- Single SSH session at a time (router has limited resources). Reopening reconnects to existing session if still alive
- WS endpoint protected by Bearer token (mihomo secret) as all other API endpoints
- Inactivity timeout: 30 minutes -- session closed if no input for 30 min
- Full copy/paste support: Ctrl+C copies selection, Ctrl+V pastes, right-click = paste (PuTTY-style)
- Search in scrollback buffer via SearchAddon (opened from toolbar or Ctrl+F)
- Scrollback buffer: 1000 lines
- Auto-reconnect on WS disconnect

### Claude's Discretion
- Exact modal animation and sizing
- SSH host key verification strategy (accept all / TOFU / warn)
- WebSocket message protocol format (binary vs JSON envelope)
- Error state UI when SSH connection fails
- Search bar positioning within terminal area

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xterm/xterm` | ^5.5.0 | Terminal emulator in browser | De facto standard for web terminals. v5.5 is latest stable in @xterm scope. v6.0 exists but is bleeding edge |
| `@xterm/addon-fit` | ^0.10.0 | Auto-resize terminal to container | Official addon, required for responsive layout |
| `@xterm/addon-search` | ^0.15.0 | Search within scrollback buffer | Official addon, user requirement for Ctrl+F search |
| `@xterm/addon-web-links` | ^0.11.0 | Clickable URLs in terminal output | Official addon, nice-to-have for SSH sessions |
| `golang.org/x/crypto/ssh` | latest | SSH client library for Go | Official Go extended library, battle-tested SSH implementation |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gorilla/websocket` | v1.5.3 | WebSocket server | Already used for log WS. Terminal WS uses same upgrader pattern |
| `zustand` | ^5.0.11 | Terminal state store | Already used project-wide. Store for terminal session state, connection status |
| `radix-ui` Dialog | ^1.4.3 | Modal dialog primitive | Already used. Base for terminal modal overlay |
| `lucide-react` | ^0.575.0 | Icons for toolbar | Already used. Terminal, SquareTerminal, Maximize2, Search, etc. |
| `sonner` | ^2.0.7 | Toast notifications | Already used. For SSH connection errors, timeout notifications |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@xterm/xterm` v5.5 | `@xterm/xterm` v6.0 | v6 is too new (Dec 2024), breaking changes, fewer community examples. Stick with v5.5 stable |
| `@xterm/addon-attach` | Custom WS handler | addon-attach is too simple -- no resize signaling, no auth, no control messages. Custom handler needed |
| `golang.org/x/crypto/ssh` | `os/exec` + `creack/pty` | Direct PTY only works if Go binary runs on the router itself with local shell access. SSH is required for remote access to router |
| Binary WS frames | JSON-only protocol | Binary is more efficient for terminal I/O (raw bytes). JSON envelope adds unnecessary encoding/decoding overhead for data that's already UTF-8 terminal output |

**Installation:**
```bash
pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links
```

**Go dependency:**
```bash
go get golang.org/x/crypto/ssh
```

## Architecture Patterns

### Recommended Project Structure
```
# Frontend
src/
  components/
    terminal/
      TerminalModal.tsx        # Dialog wrapper + keyboard shortcut listener
      TerminalView.tsx         # xterm.js instance, resize observer, WS lifecycle
      TerminalToolbar.tsx      # Connect/Disconnect, Clear, Search, Font size, Fullscreen
      TerminalConnectDialog.tsx # Login + password form before SSH connect
      useTerminalWs.ts         # WebSocket hook (similar to useLogWebSocket)
  stores/
    terminal.ts               # Zustand store: connection state, settings, session ID

# Backend (Go)
internal/
  terminal/
    session.go                # SSH client, session lifecycle, shell detection
    hub.go                    # Single-session manager with inactivity timeout
  handler/
    ws_terminal.go            # WebSocket upgrade, auth, message routing
```

### Pattern 1: WebSocket Message Protocol (Claude's Discretion)
**What:** Hybrid binary/JSON protocol for terminal WS
**When to use:** All terminal WS communication
**Recommendation:** Use binary frames for terminal data, text frames for control messages

```
# Browser -> Server (text frame, JSON)
{"type": "connect", "host": "localhost", "port": 22, "user": "root", "password": "..."}
{"type": "resize", "cols": 120, "rows": 40}
{"type": "disconnect"}
{"type": "ping"}

# Server -> Browser (text frame, JSON)
{"type": "connected", "sessionId": "..."}
{"type": "disconnected", "reason": "..."}
{"type": "error", "message": "..."}
{"type": "pong"}

# Browser -> Server (binary frame)
[raw terminal input bytes]

# Server -> Browser (binary frame)
[raw terminal output bytes]
```

**Why hybrid:** Terminal data is raw bytes (can include ANSI escape sequences, binary control codes). JSON encoding/decoding would corrupt binary data and add latency. Binary frames preserve data integrity. Control messages are infrequent and structured -- JSON is natural for them. gorilla/websocket distinguishes TextMessage vs BinaryMessage natively.

### Pattern 2: SSH Session Management in Go
**What:** Single SSH session with lifecycle management
**When to use:** Backend terminal session handling

```go
// internal/terminal/session.go
type Session struct {
    mu         sync.Mutex
    client     *ssh.Client
    session    *ssh.Session
    stdin      io.WriteCloser
    stdout     io.Reader
    stderr     io.Reader
    lastInput  time.Time
    done       chan struct{}
}

// Connect establishes SSH, requests PTY, starts shell
func (s *Session) Connect(host string, port int, user, password string, cols, rows int) error {
    config := &ssh.ClientConfig{
        User: user,
        Auth: []ssh.AuthMethod{ssh.Password(password)},
        HostKeyCallback: ssh.InsecureIgnoreHostKey(), // See security note
        Timeout: 10 * time.Second,
    }
    client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", host, port), config)
    // ...
    session, _ := client.NewSession()
    session.RequestPty("xterm-256color", rows, cols, ssh.TerminalModes{
        ssh.ECHO:          1,
        ssh.TTY_OP_ISPEED: 14400,
        ssh.TTY_OP_OSPEED: 14400,
    })
    s.stdin, _ = session.StdinPipe()
    s.stdout, _ = session.StdoutPipe()
    s.stderr, _ = session.StderrPipe()
    session.Shell() // starts interactive shell
    // ...
}

// Resize sends window-change to SSH session
func (s *Session) Resize(cols, rows int) error {
    return s.session.WindowChange(rows, cols)
}
```

### Pattern 3: Inactivity Timeout
**What:** 30-minute timeout on the SSH session if no input received
**When to use:** Always active during SSH session

```go
// In hub.go or session.go
func (s *Session) startInactivityTimer() {
    s.lastInput = time.Now()
    go func() {
        ticker := time.NewTicker(1 * time.Minute)
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C:
                if time.Since(s.lastInput) > 30*time.Minute {
                    s.Close()
                    return
                }
            case <-s.done:
                return
            }
        }
    }()
}
```

### Pattern 4: Shell Auto-Detection
**What:** Try bash, then ash, then sh on the remote host
**When to use:** When starting SSH session

```go
func detectShell(session *ssh.Session) string {
    // Instead of session.Shell(), use session.Start() with specific shell
    // Try in order: bash, ash, sh
    for _, shell := range []string{"/bin/bash", "/bin/ash", "/bin/sh"} {
        // Test with "which" or "test -x"
        testSession, _ := client.NewSession()
        if err := testSession.Run("test -x " + shell); err == nil {
            testSession.Close()
            return shell
        }
        testSession.Close()
    }
    return "/bin/sh" // fallback
}
```

**Alternative (simpler):** Just call `session.Shell()` which runs the user's default login shell. The router's default shell for root is typically ash (busybox). This avoids the extra session overhead.

**Recommendation:** Use `session.Shell()` directly -- it runs the user's configured shell from `/etc/passwd`. No need to detect. The `bash -> ash -> sh` preference can be implemented by sending `exec bash 2>/dev/null || exec ash 2>/dev/null` as the first command after shell starts if needed.

### Pattern 5: Terminal Modal with Session Persistence
**What:** Modal that persists terminal session state when closed
**When to use:** Terminal modal component

```typescript
// stores/terminal.ts -- Zustand store (NOT persisted to localStorage)
interface TerminalState {
  isOpen: boolean
  isConnected: boolean
  isConnecting: boolean
  sessionAlive: boolean  // server reports session still exists
  sshHost: string
  sshPort: number
  sshUser: string
  fontSize: number
  isFullscreen: boolean
  error: string | null

  setOpen: (v: boolean) => void
  setConnected: (v: boolean) => void
  // ...
}

// SSH settings (host, port, user) persist via settings store
// Terminal session state is volatile -- not persisted
```

The xterm.js Terminal instance lives in a ref, NOT in state. When modal closes, the Terminal instance stays alive (div is hidden, not unmounted). When modal reopens, the same Terminal instance is shown.

### Pattern 6: WS Auth for Terminal Endpoint
**What:** Terminal WS endpoint needs auth, unlike log WS
**When to use:** WebSocket upgrade handler

The existing log WS endpoint (`/ws/logs`) has NO auth (decision from Phase 12). But the terminal WS carries SSH credentials and provides shell access -- it MUST be authenticated.

```go
// In ws_terminal handler, check auth before upgrade
func (h *WsTerminalHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // Check Bearer token from query param (WebSocket can't send headers)
    token := r.URL.Query().Get("token")
    if token == "" {
        // Fallback: check Authorization header (some WS clients support it)
        token = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
    }
    secret := config.GetMihomoSecret(h.cfg.MihomoConfigPath)
    if secret != "" && token != secret {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    // Proceed with upgrade
    conn, err := upgrader.Upgrade(w, r, nil)
    // ...
}
```

Frontend sends token as query parameter: `ws://host:5000/ws/terminal?token=SECRET`

### Anti-Patterns to Avoid
- **Remounting xterm.js on modal open/close:** Kills session, loses scrollback. Keep Terminal instance alive, hide/show the container div
- **Using addon-attach for WS:** Too simple, no resize signaling, no auth, no control messages. Build custom WS handler
- **Sending terminal data as JSON:** `{"type": "data", "payload": "..."}` corrupts binary escape sequences, adds overhead. Use raw binary frames
- **Creating new SSH session on each WS reconnect:** If WS drops but SSH session is alive on server, reattach to existing session
- **Storing password in Zustand/localStorage:** Password must be ephemeral -- only in component state during connect flow, never persisted
- **Running shell detection as separate SSH sessions:** Extra overhead on constrained router. Use `session.Shell()` for default shell

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal emulation | Custom ANSI parser | `@xterm/xterm` | Thousands of edge cases in terminal emulation (ANSI codes, Unicode, cursor movement) |
| Terminal resize | Manual cols/rows calculation | `@xterm/addon-fit` | Handles DPI, container resize, font metrics correctly |
| In-terminal search | Manual buffer scanning | `@xterm/addon-search` | Handles ANSI stripping, regex, incremental search |
| SSH protocol | Raw TCP with custom handshake | `golang.org/x/crypto/ssh` | SSH is a complex protocol with key exchange, channels, auth methods |
| WebSocket upgrade | `net/http` Hijack | `gorilla/websocket` upgrader | Already in project, handles handshake, ping/pong, frame types correctly |

**Key insight:** Both xterm.js and golang.org/x/crypto/ssh are extremely mature libraries. The only custom code needed is the bridge layer (WS message routing, session lifecycle) and the UI components.

## Common Pitfalls

### Pitfall 1: xterm.js CSS Not Imported
**What goes wrong:** Terminal renders as invisible or has broken layout
**Why it happens:** xterm.js requires its CSS file for proper rendering. Without it, the canvas element has zero dimensions
**How to avoid:** Import CSS explicitly: `import '@xterm/xterm/css/xterm.css'` in the terminal component file
**Warning signs:** Terminal div exists in DOM but nothing visible, or characters overlap

### Pitfall 2: Terminal Not Fitting Container After Resize
**What goes wrong:** Terminal has wrong number of cols/rows, text wraps incorrectly
**Why it happens:** FitAddon.fit() must be called after container size changes AND new dimensions must be sent to backend for PTY resize
**How to avoid:** Use ResizeObserver on the terminal container, call fitAddon.fit() on resize, send new dimensions to backend via WS
**Warning signs:** Terminal output wraps at wrong column, commands appear garbled after window resize

### Pitfall 3: React Strict Mode Double-Mount
**What goes wrong:** Two WebSocket connections opened, two xterm instances
**Why it happens:** React 18/19 Strict Mode mounts, unmounts, remounts in development
**How to avoid:** Same pattern as useLogWebSocket -- 150ms startup delay + disposed flag + cleanup in useEffect return
**Warning signs:** Duplicate "[WS] Connected" logs, terminal input appears twice

### Pitfall 4: WebSocket Auth for Terminal
**What goes wrong:** Browser WebSocket API cannot set custom headers on upgrade request
**Why it happens:** `new WebSocket(url)` doesn't support custom headers in browsers
**How to avoid:** Pass auth token as query parameter: `ws://host/ws/terminal?token=SECRET`. Validate on server before upgrade
**Warning signs:** 401 errors on WS upgrade, or unauthenticated terminal access

### Pitfall 5: SSH Session Leaks on Disconnect
**What goes wrong:** SSH sessions accumulate on router, consuming resources
**Why it happens:** WS close doesn't properly trigger SSH session close, or server crashes without cleanup
**How to avoid:** 1) Close SSH session in WS close handler. 2) Implement 30-min inactivity timeout. 3) Close SSH session in Server.Shutdown(). 4) Single session limit
**Warning signs:** Router becomes sluggish, `who` shows multiple stale sessions

### Pitfall 6: Binary Data Corruption
**What goes wrong:** Terminal output garbled, escape sequences broken
**Why it happens:** Sending binary SSH output as JSON text, or WebSocket sends as TextMessage instead of BinaryMessage
**How to avoid:** Use `websocket.BinaryMessage` for terminal data. On client side, handle `Blob` or `ArrayBuffer` from WS and write to terminal as Uint8Array
**Warning signs:** Color codes appear as garbage text, special characters broken

### Pitfall 7: Terminal Keybinding Conflicts
**What goes wrong:** Ctrl+C doesn't work in terminal (browser intercepts), Ctrl+F opens browser search
**Why it happens:** Browser default keybindings override terminal keybindings
**How to avoid:** When terminal is focused, xterm.js captures keyboard events. For Ctrl+F, xterm.js SearchAddon intercepts when loaded. For Ctrl+C, configure xterm.js to send SIGINT when no selection, copy when selection exists. Ensure the modal's `onKeyDown` doesn't stopPropagation for terminal-bound keys
**Warning signs:** Keyboard shortcuts don't work in terminal, or work outside terminal when they shouldn't

### Pitfall 8: Terminal Modal Steals Focus from Page
**What goes wrong:** Ctrl+` opens terminal, but then keyboard events still go to page elements behind modal
**Why it happens:** Radix Dialog manages focus, but xterm.js needs focus for its canvas
**How to avoid:** On modal open, call `terminal.focus()`. On modal overlay click, close modal. Use Radix Dialog's built-in focus trap but ensure terminal canvas receives focus within it
**Warning signs:** Typing in terminal does nothing, or typing goes to page input behind modal

## Code Examples

### xterm.js React Integration Pattern
```typescript
// Source: xterm.js official docs + project patterns
import { useRef, useEffect, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export function TerminalView({ fontSize }: { fontSize: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily: 'var(--font-mono)',
      scrollback: 1000,
      theme: {
        background: '#1a1625',      // oklch(0.14 0.012 275) approx
        foreground: '#e8e4f0',      // oklch(0.93 0.01 270) approx
        cursor: '#a78bfa',          // violet accent
        selectionBackground: '#4c3d6640',
        black: '#1a1625',
        brightBlack: '#4a4458',
        // ... other ANSI colors matching Antigravity palette
      },
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)

    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // ResizeObserver for container size changes
    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      // Send new dimensions to backend via WS
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      // NOTE: Don't dispose terminal here if session persists!
      // Only dispose on unmount of the entire app
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
```

### Go SSH Client + WS Bridge
```go
// Source: golang.org/x/crypto/ssh docs + gorilla/websocket patterns
package terminal

import (
    "fmt"
    "io"
    "sync"
    "time"

    "golang.org/x/crypto/ssh"
)

type Session struct {
    mu        sync.Mutex
    client    *ssh.Client
    session   *ssh.Session
    stdin     io.WriteCloser
    stdout    io.Reader
    lastInput time.Time
    done      chan struct{}
    closed    bool
}

func NewSession() *Session {
    return &Session{done: make(chan struct{})}
}

func (s *Session) Connect(host string, port int, user, pass string, cols, rows int) error {
    s.mu.Lock()
    defer s.mu.Unlock()

    cfg := &ssh.ClientConfig{
        User:            user,
        Auth:            []ssh.AuthMethod{ssh.Password(pass)},
        HostKeyCallback: ssh.InsecureIgnoreHostKey(),
        Timeout:         10 * time.Second,
    }

    client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", host, port), cfg)
    if err != nil {
        return fmt.Errorf("SSH dial: %w", err)
    }

    session, err := client.NewSession()
    if err != nil {
        client.Close()
        return fmt.Errorf("SSH session: %w", err)
    }

    modes := ssh.TerminalModes{
        ssh.ECHO:          1,
        ssh.TTY_OP_ISPEED: 14400,
        ssh.TTY_OP_OSPEED: 14400,
    }
    if err := session.RequestPty("xterm-256color", rows, cols, modes); err != nil {
        session.Close()
        client.Close()
        return fmt.Errorf("PTY request: %w", err)
    }

    s.stdin, _ = session.StdinPipe()
    s.stdout, _ = session.StdoutPipe()
    s.client = client
    s.session = session
    s.lastInput = time.Now()

    if err := session.Shell(); err != nil {
        s.Close()
        return fmt.Errorf("shell: %w", err)
    }

    return nil
}

func (s *Session) Write(data []byte) (int, error) {
    s.mu.Lock()
    s.lastInput = time.Now()
    s.mu.Unlock()
    return s.stdin.Write(data)
}

func (s *Session) Resize(cols, rows int) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    if s.session == nil {
        return fmt.Errorf("no session")
    }
    return s.session.WindowChange(rows, cols)
}

func (s *Session) Close() {
    s.mu.Lock()
    defer s.mu.Unlock()
    if s.closed {
        return
    }
    s.closed = true
    close(s.done)
    if s.stdin != nil {
        s.stdin.Close()
    }
    if s.session != nil {
        s.session.Close()
    }
    if s.client != nil {
        s.client.Close()
    }
}
```

### WebSocket Terminal Handler
```go
// Source: project pattern from ws_logs.go + terminal adaptation
package handler

func (h *WsTerminalHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // Auth check via query param
    token := r.URL.Query().Get("token")
    secret := config.GetMihomoSecret(h.cfg.MihomoConfigPath)
    if secret != "" && token != secret {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        return
    }
    defer conn.Close()

    session := h.hub.GetOrCreateSession()

    // Read loop: browser -> server
    for {
        msgType, data, err := conn.ReadMessage()
        if err != nil {
            break
        }
        if msgType == websocket.BinaryMessage {
            // Terminal input: write to SSH stdin
            session.Write(data)
        } else {
            // Control message: JSON
            var cmd struct {
                Type     string `json:"type"`
                Host     string `json:"host,omitempty"`
                Port     int    `json:"port,omitempty"`
                User     string `json:"user,omitempty"`
                Password string `json:"password,omitempty"`
                Cols     int    `json:"cols,omitempty"`
                Rows     int    `json:"rows,omitempty"`
            }
            json.Unmarshal(data, &cmd)
            switch cmd.Type {
            case "connect":
                err := session.Connect(cmd.Host, cmd.Port, cmd.User, cmd.Password, cmd.Cols, cmd.Rows)
                // respond with connected/error
            case "resize":
                session.Resize(cmd.Cols, cmd.Rows)
            case "disconnect":
                session.Close()
            case "ping":
                conn.WriteJSON(map[string]string{"type": "pong"})
            }
        }
    }
}
```

### Antigravity Terminal Theme
```typescript
// Derived from project's index.css dark theme variables
const antigravityTermTheme = {
  background: '#1a1625',           // --background: oklch(0.14 0.012 275)
  foreground: '#e8e4f0',           // --foreground: oklch(0.93 0.01 270)
  cursor: '#a78bfa',               // violet-400 accent
  cursorAccent: '#1a1625',
  selectionBackground: '#6d28d940', // violet with transparency
  selectionForeground: '#e8e4f0',

  // ANSI standard colors (dark palette)
  black:   '#1a1625',
  red:     '#f87171',              // red-400
  green:   '#4ade80',              // green-400
  yellow:  '#facc15',              // yellow-400
  blue:    '#60a5fa',              // blue-400
  magenta: '#c084fc',              // purple-400
  cyan:    '#22d3ee',              // cyan-400
  white:   '#e8e4f0',

  // ANSI bright colors
  brightBlack:   '#4a4458',
  brightRed:     '#fca5a5',
  brightGreen:   '#86efac',
  brightYellow:  '#fde68a',
  brightBlue:    '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan:    '#67e8f9',
  brightWhite:   '#ffffff',
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xterm` + `xterm-addon-*` packages | `@xterm/xterm` + `@xterm/addon-*` scoped packages | xterm.js v5.4+ (2024) | Old unscoped packages deprecated, no longer maintained |
| `xterm-addon-attach` for simple WS | Custom WS handler with binary protocol | Ongoing | Attach addon too limited for SSH bridge with resize/auth |
| `creack/pty` for local PTY | `golang.org/x/crypto/ssh` for remote SSH | N/A (architecture decision) | SSH required because Go backend may not run on same host as shell |
| JSON text frames for all WS data | Binary frames for data, JSON for control | Best practice | Binary preserves ANSI/UTF-8 integrity, lower overhead |

**Deprecated/outdated:**
- `xterm` (unscoped npm package): Deprecated since v5.4. Use `@xterm/xterm`
- `xterm-addon-fit`, `xterm-addon-search`, etc.: Deprecated. Use `@xterm/addon-*`
- `xterm-addon-attach`: Too simple for SSH bridge. Don't use it

## Discretion Recommendations

### SSH Host Key Verification: Use InsecureIgnoreHostKey
**Reasoning:** This is a home router dashboard. The SSH connection is from the Go backend (running ON the router) to `localhost:22` (the same router). Man-in-the-middle attacks on localhost are not a realistic threat. TOFU or strict verification would require key storage and management -- unnecessary complexity for the use case. If the user configures a remote host, they accept the risk.

### WebSocket Protocol: Hybrid Binary + JSON
**Reasoning:** Detailed in Pattern 1 above. Binary frames for terminal I/O, JSON text frames for control messages. This is the standard approach used by ttyd, Wetty, VS Code Remote, and other production web terminals.

### Error State UI: Inline Banner + Toast
**Reasoning:** When SSH connection fails, show an inline error banner in the terminal area (not just a toast) with the error message and a "Retry" button. Toast for transient errors (WS disconnect). Terminal area shows "Disconnected" with reconnect prompt. This matches the project's existing toast-for-errors pattern while giving persistent visibility in the terminal.

### Modal Sizing: Large with Fullscreen Toggle
**Reasoning:** Default: `max-w-5xl w-[90vw] h-[80vh]`. Fullscreen: `w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]`. Enough screen real estate for comfortable terminal work without completely hiding the dashboard. Fullscreen toggle for extended sessions.

### Search Bar: Below Toolbar, Above Terminal
**Reasoning:** When search is activated (Ctrl+F or toolbar button), a small search input bar appears between the toolbar and the terminal content. Similar to VS Code's terminal search positioning. Uses SearchAddon's `findNext`/`findPrevious` API.

## Open Questions

1. **xterm.js v5.5 vs v6.0**
   - What we know: v6.0 released Dec 2024, includes new scroll bar system from VS Code. v5.5.0 is stable and well-documented
   - What's unclear: Whether v6.0 has breaking changes that affect addon compatibility
   - Recommendation: Use v5.5.0 (stable). Can upgrade to v6 later if needed

2. **Shell detection necessity**
   - What we know: `session.Shell()` runs the user's default shell from /etc/passwd. On Keenetic routers, root's shell is typically `/bin/sh` (busybox ash)
   - What's unclear: Whether users want bash specifically (if installed) over the default
   - Recommendation: Just use `session.Shell()`. If user wants bash, they can type `bash` manually. Avoids complexity and extra SSH sessions for detection

3. **Single session -- what happens on second browser tab?**
   - What we know: Requirement says single SSH session at a time
   - What's unclear: Should second tab connect to same session (sharing input/output)?
   - Recommendation: Second WS connection attaches as read-only viewer or gets "session busy" error. Simplest: return error "Session already active" to second connection

## Sources

### Primary (HIGH confidence)
- [golang.org/x/crypto/ssh](https://pkg.go.dev/golang.org/x/crypto/ssh) - Session.RequestPty, WindowChange, Shell, Dial, ClientConfig API
- [xterm.js official docs](https://xtermjs.org/) - Import guide, addon usage, ITheme interface
- [GitHub xtermjs/xterm.js releases](https://github.com/xtermjs/xterm.js/releases) - Version history, v5.5.0 and v6.0.0 info
- Project codebase: `internal/handler/ws_logs.go`, `internal/logwatch/hub.go`, `useLogWebSocket.ts` - Existing WS patterns

### Secondary (MEDIUM confidence)
- [npm @xterm/xterm](https://www.npmjs.com/@xterm/xterm) - Package versioning, addon list
- [npm @xterm/addon-*](https://www.npmjs.com/package/@xterm/addon-fit) - Addon versions and API
- [xterm.js ITheme docs](https://xtermjs.org/docs/api/terminal/interfaces/itheme/) - Theme properties
- [Go SSH examples](https://github.com/golang/crypto/blob/master/ssh/example_test.go) - Official examples

### Tertiary (LOW confidence)
- [Go SSH to WebSocket (Medium article)](https://medium.com/@razikus/go-ssh-to-websocket-with-xterm-js-33af2e0c3bc7) - Architecture reference (could not access full content)
- [go-ssh-web-client](https://github.com/wuchihsu/go-ssh-web-client) - Reference implementation (code not inspected)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - xterm.js and golang.org/x/crypto/ssh are well-established, versions verified via npm and pkg.go.dev
- Architecture: HIGH - WS bridge pattern is well-documented, project already has similar WS infrastructure
- Pitfalls: HIGH - Based on direct experience with the codebase (React Strict Mode, WS auth) and documented xterm.js issues
- Theme mapping: MEDIUM - oklch to hex conversion is approximate, may need fine-tuning visually

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days -- stable libraries, unlikely to change)
