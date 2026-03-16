# Phase 20: Remote Management & Reverse SSH Tunnel - Research

**Researched:** 2026-03-17
**Domain:** SSH server/client, reverse tunneling, embedded key-value storage, remote API proxying, multi-context SPA
**Confidence:** HIGH

## Summary

Phase 20 adds remote management capabilities to XMeow UI. The system architecture is a master-agent model where the master (xmeow-server) embeds an SSH server that accepts reverse tunnel connections from lightweight agents (xmeow-agent) running on remote routers behind NAT. The SSH tunnel carries API traffic (ports 5000, 9090, 22) from the master to the remote agent, enabling the master UI to seamlessly manage remote routers by switching context.

The core technology stack is already partially in place: `golang.org/x/crypto/ssh` (v0.48.0) is in go.mod for the existing terminal SSH client. The server mode of the same library provides everything needed: `ssh.ServerConfig` for authentication, `ssh.NewServerConn` for connection handling, `tcpip-forward` global requests for reverse port forwarding, and `conn.OpenChannel("forwarded-tcpip", ...)` for proxying traffic through established tunnels. No additional SSH libraries are needed.

The agent binary must be extremely lightweight (target: 2-4MB compressed) since it runs on routers with as little as 256MB RAM (MIPS). It should do only two things: maintain an SSH reverse tunnel to the master and send periodic heartbeat data. The frontend needs a "remote context" layer that redirects all API calls through the master's proxy endpoint when managing a remote router.

**Primary recommendation:** Use raw `golang.org/x/crypto/ssh` for both server and agent (no wrapper libraries). Store agent tokens/metadata in a JSON file (not embedded DB) to match the project's existing file-based config pattern. Implement context switching in the frontend via a Zustand store that controls the API base URL prefix.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Протокол**: SSH reverse tunnel (`golang.org/x/crypto/ssh` -- уже в проекте)
- **SSH-сервер встраивается в xmeow-server** (мастер) -- принимает подключения от агентов
- **Режимы подключения**: прямой (агент -> мастер по IP/домену) + VPS/relay (агент -> VPS <- мастер). Конфигурируется в агенте
- **Пробрасываемые порты**: XMeow API (5000), mihomo API (9090), SSH (22) удалённого роутера
- **Масштаб**: без ограничения количества одновременных агентов (зависит от ресурсов мастера)
- **Auto-reconnect**: агент автоматически переподключается при обрыве связи
- **Отдельный бинарник** `xmeow-agent`, путь `/opt/etc/xmeow-ui/xmeow-agent`
- **Отдельный init.d скрипт** (напр. `S99xmeow-agent`)
- **Функции агента**: поддержание SSH reverse tunnel + периодический heartbeat к мастеру
- **Heartbeat данные**: версия mihomo, uptime роутера, архитектура, имя устройства, IP
- **Конфигурация агента**: YAML/JSON файл `/opt/etc/xmeow-ui/agent.conf` с полями: server_host, server_port, token, device_name
- **Установка**: опция `setup.sh --agent` в существующем установщике
- **Сборка**: отдельный `cmd/xmeow-agent/main.go`, те же 3 архитектуры (arm64, armv7, mipsle)
- **Самообновление**: аналогично xmeow-server (через GitHub releases, отдельный артефакт)
- **Страница "Удалённые"**: новая страница в sidebar с иконкой
- **Переключатель контекста**: в sidebar/header -- селектор роутера
- **Карточки клиентов**: минималистичные -- имя устройства + статус (online/offline) + кнопка "Подключиться"
- **Empty state**: когда нет агентов -- описание возможностей функции + инструкция по установке агента
- **Видимость**: страница всегда видна в sidebar, но можно скрыть в настройках
- **Генерация токена**: кнопка в UI для создания нового токена агента
- **Проксирование API**: при работе с удалённым роутером -- запросы из SPA идут на мастер-бэкенд, который проксирует через SSH-туннель
- **Авторизация агентов**: пре-сгенерированный токен. Мастер генерирует уникальный токен для каждого агента
- **Управление доступом**: список зарегистрированных агентов с возможностью отзыва токена (бан/удаление)
- **Шифрование**: SSH достаточно, без дополнительных слоёв

### Claude's Discretion
- Порт SSH-сервера на мастере (по умолчанию, конфигурируемый)
- Формат токена (UUID, random hex, base64)
- Интервал heartbeat (например, 30с)
- Формат конфиг-файла агента (YAML vs JSON)
- Хранение списка агентов/токенов на мастере (файл vs embedded DB)
- Точная иконка для страницы "Удалённые" в sidebar
- Анимации переключения контекста роутера

### Deferred Ideas (OUT OF SCOPE)
- **Mesh-networking между агентами** -- агенты общаются напрямую, без мастера. Отдельная фаза
- **Автообнаружение устройств** в локальной сети -- не требует SSH tunnel. Отдельная фаза
- **Групповые операции** -- обновить mihomo/правила на всех удалённых роутерах одновременно. Отдельная фаза
- **Мониторинг-дашборд** -- единая сводка метрик всех удалённых роутеров. Отдельная фаза
- **Мобильное приложение** для удалённого управления. Отдельная фаза
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RMT-01 | SSH-сервер встроен в xmeow-server, принимает reverse tunnel подключения от агентов с токен-авторизацией | `golang.org/x/crypto/ssh` ServerConfig + PasswordCallback для token auth + tcpip-forward global request handling. Паттерн NewServerConn -> handle channels + global requests |
| RMT-02 | xmeow-agent -- отдельный бинарник, устанавливается через `setup.sh --agent`, поддерживает auto-reconnect и heartbeat | Отдельный cmd/xmeow-agent/main.go. SSH client с ssh.Dial + reverse port forwarding. Exponential backoff для reconnect. Setup.sh расширяется флагом --agent |
| RMT-03 | Heartbeat передаёт: версия mihomo, uptime, архитектура, имя устройства | SSH custom global request ("heartbeat") или JSON через выделенный SSH channel. Данные: runtime.GOARCH, os.Hostname(), exec("mihomo -v"), time.Since(startTime) |
| RMT-04 | Страница "Удалённые" показывает список агентов (online/offline) с empty state инструкцией | React page + Zustand store. GET /api/remote/agents endpoint. Empty state с SetupGuide-подобной инструкцией |
| RMT-05 | Переключатель контекста в sidebar позволяет переключить весь дашборд на удалённый роутер | Zustand store `useRemoteStore` с activeAgentId. API interceptor меняет base URL на /api/remote/{agentId}/proxy/... |
| RMT-06 | При работе с удалённым роутером API-запросы проксируются через SSH-туннель (порты 5000, 9090, 22) | httputil.ReverseProxy на мастере, target = localhost:{tunneled_port}. Маршрут /api/remote/{agentId}/proxy/* |
| RMT-07 | Генерация/отзыв токенов агентов из UI мастер-панели | POST /api/remote/tokens (generate), DELETE /api/remote/tokens/{id} (revoke). crypto/rand 32 bytes -> hex. Хранение в agents.json |
| RMT-08 | Поддержка прямого подключения (агент -> мастер) и через VPS/relay | Конфигурация в agent.conf: server_host может быть IP мастера (прямое) или VPS (relay). Для VPS мастер тоже подключается к VPS SSH и слушает через него |
| RMT-09 | xmeow-agent собирается для 3 архитектур (arm64, armv7, mipsle) в CI | Отдельный build target в Makefile/CI. Аналогично xmeow-server: GOOS=linux GOARCH={arch} go build -o xmeow-agent ./cmd/xmeow-agent/ |
| RMT-10 | Страницу "Удалённые" можно скрыть в настройках | Поле showRemotePage в useSettingsStore (persist). Switch в SettingsPage секция "Интерфейс". Sidebar фильтрует по этому полю |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `golang.org/x/crypto/ssh` | v0.48.0 (уже в go.mod) | SSH server + client + tunnel | Стандартная Go библиотека для SSH, единственный production-ready вариант. Уже используется для terminal SSH client |
| `crypto/ed25519` | stdlib | Host key generation | Легче RSA (32 байта ключ vs 2048+ бит), быстрее, встроен в Go stdlib. Идеально для embedded устройств |
| `crypto/rand` | stdlib | Token generation | Криптографически стойкий генератор. 32 байта -> 64 символа hex -- достаточная энтропия |
| `encoding/json` | stdlib | Agent/token storage, agent config | Уже используется повсеместно в проекте для конфигурации |
| `gorilla/websocket` | v1.5.3 (уже в go.mod) | Agent status WebSocket updates | Для real-time обновлений статуса агентов на frontend. Паттерн из ws_terminal.go |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `go-chi/chi/v5` | v5.2.5 (уже в go.mod) | HTTP routing для remote API endpoints | Новая группа маршрутов /api/remote/* |
| `net/http/httputil` | stdlib | Reverse proxy для tunnel traffic | Проксирование API-запросов через SSH tunnel на remote agent |
| `crypto/x509` + `encoding/pem` | stdlib | SSH host key persistence | Сохранение/загрузка ed25519 ключа в PEM файл |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON file для токенов | bbolt (etcd-io/bbolt v1.4.x) | bbolt дает ACID и concurrent safety, но overkill для 10-50 токенов. JSON файл проще, human-readable, соответствует паттерну проекта (xmeow-ui.conf). Миграция на bbolt позже при необходимости |
| Raw x/crypto/ssh server | gliderlabs/ssh | Более высокоуровневый API, но: не поддерживает reverse tunnel handling из коробки, добавляет зависимость, менее гибкий для нашего нестандартного use case (tunnel + heartbeat + token auth) |
| SSH tunnel для всех портов | HTTP tunnel (chisel, frp) | SSH уже в проекте, нативная поддержка port forwarding, шифрование из коробки. HTTP tunnel -- лишняя зависимость |
| ed25519 host key | RSA 2048 | ed25519 быстрее, меньше (32 vs 256+ байт), более современный. RSA только если нужна совместимость со старыми клиентами (не нужна) |
| JSON agent config | YAML agent config | JSON: проще парсить в Go (encoding/json stdlib), не нужен goccy/go-yaml для простой плоской структуры. YAML визуально удобнее для людей, но agent.conf крошечный (4-5 полей) |

**Installation:** Все зависимости уже в go.mod. Новых зависимостей нет.

## Architecture Patterns

### Recommended Project Structure

```
# Go backend additions
internal/
├── sshserver/           # SSH server for accepting agent tunnels
│   ├── server.go        # SSH server lifecycle, accept loop, host key management
│   ├── tunnel.go        # Reverse tunnel handler (tcpip-forward), port allocation
│   └── agent.go         # Agent state, heartbeat processing, connection tracking
├── remote/              # Remote management business logic
│   ├── store.go         # Agent/token persistence (JSON file read/write)
│   └── proxy.go         # HTTP reverse proxy through SSH tunnel
├── handler/
│   └── remote.go        # REST API handlers for /api/remote/*
cmd/
├── xmeow-server/
│   └── main.go          # Existing -- add SSH server startup
└── xmeow-agent/
    └── main.go          # New agent binary

# Frontend additions
src/
├── pages/
│   └── RemotePage.tsx   # "Удалённые" page
├── components/
│   └── remote/
│       ├── AgentCard.tsx         # Agent card (name, status, connect button)
│       ├── AgentList.tsx         # Agent list with empty state
│       ├── TokenManager.tsx      # Generate/revoke tokens UI
│       └── ContextSwitcher.tsx   # Router context selector in sidebar
├── stores/
│   └── remote.ts        # Zustand store for remote agents + context
├── lib/
│   └── remote-api.ts    # API client for /api/remote/* endpoints
└── hooks/
    └── useRemoteContext.ts  # Hook that returns context-aware API base URL
```

### Pattern 1: SSH Server with Reverse Tunnel Handling

**What:** Embedded SSH server in xmeow-server that accepts agent connections, handles token auth, and manages reverse port forwarding.

**When to use:** Master server initialization.

**Example:**
```go
// Source: golang.org/x/crypto/ssh official docs + project pattern
package sshserver

import (
    "crypto/ed25519"
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "log"
    "net"
    "sync"

    "golang.org/x/crypto/ssh"
)

type Server struct {
    mu       sync.RWMutex
    config   *ssh.ServerConfig
    listener net.Listener
    agents   map[string]*AgentConn // token -> agent
    done     chan struct{}
}

type AgentConn struct {
    Name         string
    Arch         string
    MihomoVer    string
    IP           string
    Uptime       int64
    conn         ssh.Conn
    tunnelPorts  map[int]int // remote port -> local forwarded port
    lastHeartbeat time.Time
}

func NewServer(hostKeyPath string, validateToken func(token string) (agentID string, ok bool)) (*Server, error) {
    hostKey, err := loadOrGenerateHostKey(hostKeyPath)
    if err != nil {
        return nil, err
    }

    s := &Server{
        agents: make(map[string]*AgentConn),
        done:   make(chan struct{}),
    }

    s.config = &ssh.ServerConfig{
        // Token-based auth: agent sends token as password
        PasswordCallback: func(c ssh.ConnMetadata, pass string) (*ssh.Permissions, error) {
            agentID, ok := validateToken(string(pass))
            if !ok {
                return nil, fmt.Errorf("invalid token")
            }
            return &ssh.Permissions{
                Extensions: map[string]string{"agent-id": agentID},
            }, nil
        },
    }
    s.config.AddHostKey(hostKey)
    return s, nil
}

func (s *Server) ListenAndServe(addr string) error {
    ln, err := net.Listen("tcp", addr)
    if err != nil {
        return err
    }
    s.listener = ln
    log.Printf("[SSH Server] Listening on %s", addr)

    for {
        conn, err := ln.Accept()
        if err != nil {
            select {
            case <-s.done:
                return nil
            default:
                log.Printf("[SSH Server] Accept error: %v", err)
                continue
            }
        }
        go s.handleConnection(conn)
    }
}

func (s *Server) handleConnection(netConn net.Conn) {
    sshConn, chans, reqs, err := ssh.NewServerConn(netConn, s.config)
    if err != nil {
        log.Printf("[SSH Server] Handshake failed: %v", err)
        return
    }
    defer sshConn.Close()

    agentID := sshConn.Permissions.Extensions["agent-id"]
    log.Printf("[SSH Server] Agent %s connected from %s", agentID, netConn.RemoteAddr())

    agent := &AgentConn{
        conn:        sshConn,
        tunnelPorts: make(map[int]int),
    }
    s.registerAgent(agentID, agent)
    defer s.unregisterAgent(agentID)

    // Handle global requests (tcpip-forward for reverse tunnels, heartbeat)
    go s.handleGlobalRequests(agentID, agent, sshConn, reqs)

    // Discard channel opens from agent (we don't expect any)
    go ssh.DiscardRequests(nil) // channels handled separately
    for newChan := range chans {
        newChan.Reject(ssh.Prohibited, "no channels allowed from agent")
    }
}
```

### Pattern 2: Reverse Tunnel Port Forwarding

**What:** Handle `tcpip-forward` requests from agents to set up local listeners that proxy traffic through the SSH tunnel.

**When to use:** When an agent requests reverse port forwarding for its services (5000, 9090, 22).

**Example:**
```go
// Source: SSH RFC 4254 + golang.org/x/crypto/ssh API
type forwardRequest struct {
    BindAddr string
    BindPort uint32
}

type forwardResponse struct {
    Port uint32
}

type forwardedTCPPayload struct {
    Addr       string
    Port       uint32
    OriginAddr string
    OriginPort uint32
}

func (s *Server) handleTCPIPForward(agent *AgentConn, req *ssh.Request) {
    var fwd forwardRequest
    if err := ssh.Unmarshal(req.Payload, &fwd); err != nil {
        req.Reply(false, nil)
        return
    }

    // Allocate a random local port for the forwarded service
    ln, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        req.Reply(false, nil)
        return
    }

    localPort := ln.Addr().(*net.TCPAddr).Port
    agent.tunnelPorts[int(fwd.BindPort)] = localPort

    // Reply with allocated port
    req.Reply(true, ssh.Marshal(forwardResponse{Port: uint32(localPort)}))

    log.Printf("[SSH Tunnel] Forwarding localhost:%d -> agent:%d", localPort, fwd.BindPort)

    // Accept connections on local port, forward through SSH tunnel
    go func() {
        defer ln.Close()
        for {
            conn, err := ln.Accept()
            if err != nil {
                return
            }
            go s.forwardConnection(agent, conn, fwd.BindAddr, fwd.BindPort)
        }
    }()
}

func (s *Server) forwardConnection(agent *AgentConn, local net.Conn, remoteAddr string, remotePort uint32) {
    defer local.Close()

    payload := ssh.Marshal(forwardedTCPPayload{
        Addr:       remoteAddr,
        Port:       remotePort,
        OriginAddr: "127.0.0.1",
        OriginPort: 0,
    })

    // Open a forwarded-tcpip channel to the agent
    channel, reqs, err := agent.conn.OpenChannel("forwarded-tcpip", payload)
    if err != nil {
        log.Printf("[SSH Tunnel] OpenChannel failed: %v", err)
        return
    }
    defer channel.Close()
    go ssh.DiscardRequests(reqs)

    // Bidirectional copy
    go io.Copy(channel, local)
    io.Copy(local, channel)
}
```

### Pattern 3: Agent Heartbeat via SSH Custom Request

**What:** Agent sends periodic heartbeat data as SSH global requests.

**When to use:** Every 30 seconds from the agent to the master.

**Example:**
```go
// Agent side
type HeartbeatData struct {
    DeviceName string `json:"device_name"`
    Arch       string `json:"arch"`
    MihomoVer  string `json:"mihomo_ver"`
    Uptime     int64  `json:"uptime_sec"`
    IP         string `json:"ip"`
}

func (a *Agent) heartbeatLoop(conn ssh.Conn) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            data := a.collectHeartbeat()
            payload, _ := json.Marshal(data)
            // Send as custom global request "heartbeat"
            ok, _, err := conn.SendRequest("heartbeat", true, payload)
            if err != nil || !ok {
                log.Printf("[Agent] Heartbeat failed, connection may be lost")
                return
            }
        case <-a.done:
            return
        }
    }
}

// Server side
func (s *Server) handleGlobalRequests(agentID string, agent *AgentConn, conn ssh.Conn, reqs <-chan *ssh.Request) {
    for req := range reqs {
        switch req.Type {
        case "tcpip-forward":
            s.handleTCPIPForward(agent, req)
        case "cancel-tcpip-forward":
            req.Reply(true, nil)
        case "heartbeat":
            var hb HeartbeatData
            if err := json.Unmarshal(req.Payload, &hb); err == nil {
                agent.Name = hb.DeviceName
                agent.Arch = hb.Arch
                agent.MihomoVer = hb.MihomoVer
                agent.Uptime = hb.Uptime
                agent.IP = hb.IP
                agent.lastHeartbeat = time.Now()
            }
            req.Reply(true, nil)
        default:
            req.Reply(false, nil)
        }
    }
}
```

### Pattern 4: Frontend Context Switching

**What:** Zustand store that controls which router's API is being accessed. All API calls go through a context-aware URL builder.

**When to use:** When switching between local and remote router management.

**Example:**
```typescript
// stores/remote.ts
interface RemoteState {
  activeAgentId: string | null  // null = local router
  agents: AgentInfo[]
  setActiveAgent: (id: string | null) => void
  // ...
}

// hooks/useRemoteContext.ts
export function useApiBaseUrl(): { configApi: string; mihomoApi: string } {
  const activeAgentId = useRemoteStore((s) => s.activeAgentId)
  const configApiUrl = useSettingsStore((s) => s.configApiUrl)
  const mihomoApiUrl = useSettingsStore((s) => s.mihomoApiUrl)

  if (!activeAgentId) {
    return { configApi: configApiUrl, mihomoApi: mihomoApiUrl }
  }

  // Remote mode: all requests go through master backend proxy
  return {
    configApi: `${configApiUrl}/api/remote/${activeAgentId}/proxy`,
    mihomoApi: `${configApiUrl}/api/remote/${activeAgentId}/mihomo`,
  }
}
```

### Pattern 5: API Proxy Through SSH Tunnel

**What:** Master backend proxies HTTP requests to remote agent through the established SSH tunnel.

**When to use:** When the frontend is in remote context and makes API calls.

**Example:**
```go
// handler/remote.go
func (h *RemoteHandler) ProxyToAgent(w http.ResponseWriter, r *http.Request) {
    agentID := chi.URLParam(r, "agentID")
    agent := h.sshServer.GetAgent(agentID)
    if agent == nil {
        http.Error(w, "agent not connected", http.StatusBadGateway)
        return
    }

    // Get the local forwarded port for the agent's XMeow API (5000)
    localPort, ok := agent.tunnelPorts[5000]
    if !ok {
        http.Error(w, "tunnel not established", http.StatusBadGateway)
        return
    }

    target, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
    proxy := &httputil.ReverseProxy{
        Rewrite: func(pr *httputil.ProxyRequest) {
            pr.SetURL(target)
            // Strip /api/remote/{agentID}/proxy prefix
            path := strings.TrimPrefix(pr.Out.URL.Path,
                fmt.Sprintf("/api/remote/%s/proxy", agentID))
            pr.Out.URL.Path = path
        },
    }
    proxy.ServeHTTP(w, r)
}
```

### Anti-Patterns to Avoid
- **Single SSH connection for everything:** Each agent gets ONE SSH connection with multiple forwarded channels. Do NOT open multiple SSH connections per agent.
- **Polling for agent status from frontend:** Use WebSocket for real-time agent status updates (online/offline transitions), not HTTP polling.
- **Global mutable state for active context:** Use Zustand store, not React context or global variables. The context switcher must persist across page navigation.
- **Hardcoded tunnel port numbers:** Use dynamic port allocation (`net.Listen("tcp", "127.0.0.1:0")`) to avoid port conflicts between multiple agents.
- **Token in URL query parameters for agent auth:** Use SSH password field to carry the token. Never expose tokens in URLs/logs.
- **Blocking SSH operations on main goroutine:** All SSH accept/read/write must be in dedicated goroutines with proper cleanup via context cancellation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH protocol implementation | Custom TCP protocol with encryption | `golang.org/x/crypto/ssh` | SSH is a complex protocol with key exchange, encryption, MACs, compression. Hand-rolling is a security risk |
| Host key management | Manual key serialization | `ssh.MarshalAuthorizedKey` + `ssh.ParsePrivateKey` + `crypto/x509` PEM | Encoding format must be correct for SSH interop |
| Port forwarding protocol | Custom tunnel multiplexing | SSH `tcpip-forward` + `forwarded-tcpip` channels | RFC 4254 defines the protocol, x/crypto/ssh implements it |
| HTTP reverse proxy | Manual request forwarding | `net/http/httputil.ReverseProxy` | Handles headers, streaming, chunked encoding, websocket upgrade correctly |
| Reconnection logic | Custom timers | `time.Timer` with exponential backoff + jitter | Must handle: immediate retry, exponential backoff, max delay cap, jitter to prevent thundering herd |
| Token generation | `math/rand` or UUID | `crypto/rand` + `encoding/hex` | Must be cryptographically unpredictable. math/rand is deterministic |

**Key insight:** The entire tunnel infrastructure is handled by SSH protocol primitives. The only custom code needed is: authentication (token validation), heartbeat (custom SSH request type), and the HTTP proxy layer that connects the tunnel to the frontend.

## Common Pitfalls

### Pitfall 1: SSH Connection Deadlock
**What goes wrong:** SSH channels and requests must be consumed. If the `<-chan NewChannel` or `<-chan *ssh.Request` returned by `NewServerConn` are not drained, the SSH connection hangs.
**Why it happens:** The SSH multiplexer blocks when internal buffers fill up.
**How to avoid:** Always consume both channels in goroutines: `go ssh.DiscardRequests(reqs)` if not handling requests, and always range over the `chans` channel.
**Warning signs:** Agent connects but heartbeats stop, or tunnel stops forwarding data.

### Pitfall 2: Port Exhaustion on Master
**What goes wrong:** Each agent forwards 3 ports (5000, 9090, 22). With 100 agents, that's 300 local listeners.
**Why it happens:** Dynamic port allocation from ephemeral range (typically 32768-60999).
**How to avoid:** Track allocated ports per agent. Clean up listeners when agent disconnects. Log port allocation/deallocation. Consider limiting max agents based on available ephemeral ports.
**Warning signs:** `bind: address already in use` errors in SSH server logs.

### Pitfall 3: Stale Agent State After Disconnect
**What goes wrong:** Agent disconnects but UI still shows it as "online" until next heartbeat timeout.
**Why it happens:** SSH connection drops are detected asynchronously. The `chans` channel closes when connection drops, but state update may lag.
**How to avoid:** Close all tunnel listeners immediately when SSH connection closes. Update agent state to "offline" in the disconnect handler (deferred unregister). Notify frontend via WebSocket immediately.
**Warning signs:** UI shows agent as "online" but API proxy returns "502 Bad Gateway".

### Pitfall 4: Context Leak Between Routers
**What goes wrong:** After switching from remote back to local, some API calls still go to the remote agent. Or WebSocket connections (logs, terminal) from previous context remain open.
**Why it happens:** React components may hold stale closures over the API base URL. WebSocket connections are long-lived.
**How to avoid:** Context switch must: (1) close all active WebSocket connections, (2) clear volatile stores (logs, connections), (3) re-fetch all data for new context. Use a "context version" counter that components check before making requests.
**Warning signs:** Logs from remote router appear in local view, or vice versa.

### Pitfall 5: Agent Binary Size on MIPS
**What goes wrong:** Agent binary is too large for MIPS routers with limited flash/RAM.
**Why it happens:** Go binaries include runtime, GC, and all imported packages. Importing unnecessary packages inflates the binary.
**How to avoid:** Minimal imports in xmeow-agent. Do NOT import: goccy/go-yaml, gorilla/websocket, chi, or any HTTP packages. Agent needs only: `golang.org/x/crypto/ssh`, `encoding/json`, `crypto/rand`, `os`, `os/exec` (for mihomo version). Target: < 4MB compressed with UPX.
**Warning signs:** Binary > 8MB before compression, or > 5MB after UPX.

### Pitfall 6: SSH Host Key Regeneration on Restart
**What goes wrong:** Server generates a new host key on every restart. Agents that cache the old key reject the connection (host key changed = potential MITM attack).
**Why it happens:** Host key generated in memory without persistence.
**How to avoid:** Generate host key ONCE, save to `/opt/etc/xmeow-ui/ssh_host_ed25519_key`. On startup, load from file. Only generate if file doesn't exist.
**Warning signs:** Agents log "host key mismatch" after master restart.

### Pitfall 7: Cross-Filesystem Rename (from project history)
**What goes wrong:** `os.Rename()` fails when source and destination are on different filesystems (e.g., /tmp vs /opt).
**Why it happens:** rename(2) syscall cannot cross filesystem boundaries.
**How to avoid:** Download files to the same directory as the target. Use `io.Copy` fallback if rename fails. This lesson was learned in v0.1.3 release.
**Warning signs:** "invalid cross-device link" error.

### Pitfall 8: VPS/Relay Mode Complexity
**What goes wrong:** VPS relay adds a second SSH connection layer. The master must also SSH to the VPS and set up its own reverse tunnel.
**Why it happens:** Both master and agent are behind NAT; neither can reach the other directly.
**How to avoid:** Phase 1 implementation: support only direct mode (agent -> master). VPS relay is a configuration variant: agent connects to VPS instead of master directly. Master opens its own SSH tunnel to VPS to reach the agent's forwarded ports. Keep relay logic in a separate module.
**Warning signs:** Dual SSH tunnel latency, complex error states.

## Code Examples

### Ed25519 Host Key Generation and Persistence

```go
// Source: Go stdlib crypto/ed25519 + crypto/x509 + encoding/pem
package sshserver

import (
    "crypto/ed25519"
    "crypto/rand"
    "crypto/x509"
    "encoding/pem"
    "os"

    "golang.org/x/crypto/ssh"
)

func loadOrGenerateHostKey(path string) (ssh.Signer, error) {
    // Try loading existing key
    data, err := os.ReadFile(path)
    if err == nil {
        return ssh.ParsePrivateKey(data)
    }

    // Generate new ed25519 key
    _, priv, err := ed25519.GenerateKey(rand.Reader)
    if err != nil {
        return nil, fmt.Errorf("generate key: %w", err)
    }

    // Marshal to PKCS8 DER
    der, err := x509.MarshalPKCS8PrivateKey(priv)
    if err != nil {
        return nil, fmt.Errorf("marshal key: %w", err)
    }

    // Encode as PEM
    pemBlock := &pem.Block{
        Type:  "PRIVATE KEY",
        Bytes: der,
    }
    pemData := pem.EncodeToMemory(pemBlock)

    // Save to file (0600 permissions -- owner read/write only)
    if err := os.WriteFile(path, pemData, 0600); err != nil {
        return nil, fmt.Errorf("save key: %w", err)
    }

    return ssh.ParsePrivateKey(pemData)
}
```

### Token Generation and Storage

```go
// Source: project pattern from internal/config/config.go
package remote

import (
    "crypto/rand"
    "encoding/hex"
    "encoding/json"
    "os"
    "sync"
    "time"
)

type AgentToken struct {
    ID        string    `json:"id"`
    Token     string    `json:"token"`
    Name      string    `json:"name"`       // Human label
    CreatedAt time.Time `json:"created_at"`
    LastSeen  time.Time `json:"last_seen,omitempty"`
    Revoked   bool      `json:"revoked,omitempty"`
}

type Store struct {
    mu     sync.RWMutex
    path   string
    tokens []AgentToken
}

func GenerateToken() (string, error) {
    b := make([]byte, 32)
    if _, err := rand.Read(b); err != nil {
        return "", err
    }
    return hex.EncodeToString(b), nil // 64 hex chars
}

func (s *Store) Load() error {
    s.mu.Lock()
    defer s.mu.Unlock()

    data, err := os.ReadFile(s.path)
    if os.IsNotExist(err) {
        s.tokens = nil
        return nil
    }
    if err != nil {
        return err
    }
    return json.Unmarshal(data, &s.tokens)
}

func (s *Store) Save() error {
    // Caller must hold mu
    data, err := json.MarshalIndent(s.tokens, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(s.path, data, 0600)
}
```

### Agent Auto-Reconnect with Exponential Backoff

```go
// Source: standard Go reconnection pattern
package main

import (
    "log"
    "math"
    "math/rand"
    "time"

    "golang.org/x/crypto/ssh"
)

const (
    initialDelay = 1 * time.Second
    maxDelay     = 5 * time.Minute
    jitterFrac   = 0.3 // +/- 30% jitter
)

func (a *Agent) connectLoop() {
    attempt := 0
    for {
        select {
        case <-a.done:
            return
        default:
        }

        err := a.connect()
        if err != nil {
            attempt++
            delay := backoff(attempt)
            log.Printf("[Agent] Connection failed (attempt %d): %v. Retrying in %v", attempt, err, delay)
            time.Sleep(delay)
            continue
        }

        // Connected successfully -- reset attempt counter
        attempt = 0
        log.Printf("[Agent] Connected to %s", a.serverAddr)

        // Run tunnel + heartbeat (blocks until disconnect)
        a.runSession()
        log.Printf("[Agent] Disconnected, will reconnect...")
    }
}

func backoff(attempt int) time.Duration {
    delay := float64(initialDelay) * math.Pow(2, float64(attempt-1))
    if delay > float64(maxDelay) {
        delay = float64(maxDelay)
    }
    // Add jitter
    jitter := delay * jitterFrac * (2*rand.Float64() - 1)
    return time.Duration(delay + jitter)
}
```

### Agent Configuration File

```json
// /opt/etc/xmeow-ui/agent.conf
{
  "server_host": "192.168.1.100",
  "server_port": 2222,
  "token": "a1b2c3d4e5f6...(64 hex chars)",
  "device_name": "Keenetic-Office"
}
```

### Init.d Script for Agent

```sh
#!/bin/sh
# /opt/etc/init.d/S99xmeow-agent
CONF="/opt/etc/xmeow-ui/agent.conf"
BIN="/opt/etc/xmeow-ui/xmeow-agent"
PIDFILE="/opt/var/run/xmeow-agent.pid"

case "$1" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "xmeow-agent already running"
        else
            echo "Starting xmeow-agent..."
            "$BIN" -config "$CONF" > /dev/null 2>&1 &
            echo $! > "$PIDFILE"
        fi
        ;;
    stop)
        if [ -f "$PIDFILE" ]; then
            kill "$(cat "$PIDFILE")" 2>/dev/null
            rm -f "$PIDFILE"
        fi
        ;;
    restart) "$0" stop; sleep 1; "$0" start ;;
    status)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            echo "xmeow-agent running"
        else
            echo "xmeow-agent not running"
        fi
        ;;
esac
```

## Discretion Decisions (Recommendations)

### SSH Server Port: 2222
- Avoids conflict with system SSH on port 22
- Configurable via environment variable `SSH_PORT` or config field
- Agent connects to this port

### Token Format: 32 random bytes -> 64 hex chars
- `crypto/rand.Read(32 bytes)` -> `hex.EncodeToString` -> 64 character string
- 256 bits of entropy -- more than sufficient
- Hex is URL-safe, log-safe, copy-paste friendly
- Example: `a3f7b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1`

### Heartbeat Interval: 30 seconds
- Balance between freshness and overhead
- On MIPS routers, SSH keepalive + heartbeat every 30s is negligible CPU/bandwidth
- Server marks agent "offline" after 90s (3 missed heartbeats)

### Agent Config Format: JSON
- Simpler parsing with Go stdlib `encoding/json`
- Only 4-5 fields, no nested structures
- Matches project pattern (xmeow-ui.conf is shell-sourceable but simple key=value)
- File extension: `.conf` (for consistency) with JSON content

### Token Storage: JSON file at `/opt/etc/xmeow-ui/agents.json`
- Human-readable, easy to debug
- File-level mutex in Go for concurrent access
- Matches project's file-based config pattern (no database)
- Permissions: 0600 (tokens are secrets)
- Structure: array of AgentToken objects

### Sidebar Icon: `Monitor` from lucide-react
- Represents remote devices/screens
- Distinct from existing icons (Home, Globe, Link2, etc.)
- Alternative: `Radio` (for signal/remote connection) or `Laptop` -- but Monitor is clearest

### Context Switch Animation: 200ms fade + subtle slide
- Consistent with existing tab animation (Phase 18: ~200ms)
- Fade out current data -> update stores -> fade in new data
- Visual indicator in sidebar showing active router name + colored dot

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom TCP tunneling protocols | SSH-based tunneling | Always standard | SSH provides encryption, auth, multiplexing for free |
| RSA 2048+ host keys | Ed25519 host keys | ~2020 widespread | Smaller keys, faster operations, especially important on embedded |
| Polling for agent status | WebSocket real-time updates | Project pattern | Immediate online/offline notifications |
| Embedded database for small config | JSON files with file-level locking | Project pattern | Simpler, human-readable, sufficient for 10-50 entries |
| gliderlabs/ssh wrapper | Raw x/crypto/ssh | For tunnel use case | Wrapper doesn't add value for reverse tunnel handling |

**Deprecated/outdated:**
- **DSA SSH keys**: Deprecated in OpenSSH 7.0+ (2015). Never use.
- **SSH protocol v1**: Dead since 2006. x/crypto/ssh only supports v2.
- **gliderlabs/ssh for tunnels**: The library focuses on session/shell handling, not tunnel management. Use raw x/crypto/ssh.

## Open Questions

1. **VPS/Relay Mode Implementation Depth**
   - What we know: Agent can connect to VPS instead of master. Master also connects to VPS to reach agent.
   - What's unclear: Should the master act as an SSH client to VPS, or should VPS relay traffic via HTTP? How does the master discover which VPS port maps to which agent?
   - Recommendation: Implement direct mode first (RMT-08 partial). VPS relay as follow-up sub-phase. The agent config supports it (server_host = VPS IP), but master-side VPS connection logic deferred.

2. **WebSocket Proxy Through SSH Tunnel**
   - What we know: mihomo /ws/logs and terminal /ws/terminal are WebSocket endpoints. These need to work through the tunnel.
   - What's unclear: Does `httputil.ReverseProxy` handle WebSocket upgrade correctly when proxying through the tunnel?
   - Recommendation: Test explicitly. If ReverseProxy doesn't handle Upgrade, use a dedicated WebSocket proxy (read from client WS, write to tunnel WS, bidirectional). Mark as risk for testing.

3. **Agent Self-Update Mechanism**
   - What we know: Agent should self-update like xmeow-server (GitHub releases).
   - What's unclear: How does the agent check for updates? Direct GitHub API access from agent? Or master pushes update notification via SSH?
   - Recommendation: Agent checks GitHub API directly (same as xmeow-server pattern). Master can also notify via SSH request ("update-available"). Phase 20 focuses on basic agent; self-update can be a sub-task.

4. **Maximum Concurrent Agents Practical Limit**
   - What we know: No artificial limit. Each agent uses 1 SSH connection + 3 forwarded port listeners.
   - What's unclear: What's the practical limit on a Keenetic ARM64 router with 512MB RAM?
   - Recommendation: Test with 10-20 agents. Each SSH connection ~50KB memory overhead + 3 goroutines + 3 listeners. Estimated: ~100 agents feasible on 512MB. Add configurable max_agents as safety valve.

## Sources

### Primary (HIGH confidence)
- `golang.org/x/crypto/ssh` package documentation (pkg.go.dev) -- SSH server API, ServerConfig, NewServerConn, OpenChannel, tcpip-forward handling
- Go stdlib `crypto/ed25519`, `crypto/rand`, `encoding/pem` -- key generation and persistence
- Project source code (internal/terminal/session.go, hub.go, ws_terminal.go) -- existing SSH client patterns and Hub architecture
- Project source code (internal/server/routes.go, middleware.go) -- routing and auth patterns
- Project source code (internal/proxy/mihomo.go) -- reverse proxy pattern with httputil.ReverseProxy
- Project source code (setup.sh) -- installer patterns for extending with --agent
- etcd-io/bbolt documentation via Context7 -- evaluated and rejected in favor of JSON file

### Secondary (MEDIUM confidence)
- gliderlabs/ssh README (GitHub) -- evaluated as alternative, rejected for lacking tunnel support
- bbolt documentation (pkg.go.dev) -- v1.4.3, ACID KV store, evaluated for token storage

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in go.mod or Go stdlib, patterns verified in existing codebase
- Architecture: HIGH -- SSH reverse tunnel is well-documented in RFC 4254, x/crypto/ssh implements it. Project patterns clearly established
- Pitfalls: HIGH -- several pitfalls derived from project's own history (cross-FS rename, init.d naming, restart after binary replace)
- Frontend integration: MEDIUM -- context switching pattern is novel for this project, WebSocket proxy through tunnel needs testing
- VPS/Relay mode: LOW -- not researched in depth, deferred complexity

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain, no fast-moving dependencies)
