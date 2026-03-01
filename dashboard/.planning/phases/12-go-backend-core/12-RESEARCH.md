# Phase 12: Go Backend Core - Research

**Researched:** 2026-03-02
**Domain:** Go HTTP server, WebSocket, embed.FS, reverse proxy, YAML config management
**Confidence:** HIGH

## Summary

Phase 12 -- полная замена Flask backend на Go бинарник с идентичным API-контрактом. Текущий Flask backend (backend/server.py, 653 строки) содержит 15 REST эндпоинтов + WebSocket стриминг логов. Go backend должен портировать 1:1 все эндпоинты, сохраняя JSON-формат ответов и WS-протокол (initial/append/clear/ping/pong).

Стек Go 2026 хорошо подходит для задачи: stdlib net/http (Go 1.22+) поддерживает method routing и path parameters, chi v5 добавляет middleware grouping и subrouters, embed.FS (Go 1.16+) позволяет встроить SPA в бинарник, httputil.ReverseProxy обеспечивает проксирование mihomo API. Целевые архитектуры (arm64/mipsle/mips) полностью поддерживаются Go cross-compilation с GOMIPS=softfloat.

**Primary recommendation:** chi v5.2.5 (без внешних зависимостей, совместим с net/http middleware) + gorilla/websocket v1.5.3 (стабильный, хорошо документированный) + goccy/go-yaml (активно поддерживается, заменяет архивированный gopkg.in/yaml.v3) + fsnotify v1.9.0 (реактивный file watching). Go 1.23+ как минимальная версия (Go 1.26 текущая stable).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Go 1.23+ (embed.FS, generics, новый ServeMux)
- gorilla/websocket для WebSocket стриминга логов
- API key аутентификация через заголовок (Bearer token или X-API-Key), ключ из поля `secret` в mihomo config.yaml
- Два порта: Go backend на :5000, mihomo на :9090
- Reverse proxy как опция: Go может проксировать mihomo API
- Адрес mihomo читается из `external-controller` в mihomo config.yaml
- Standard Go layout: cmd/antigravity/main.go + internal/ packages
- Монорепо: go.mod в корне dashboard/, рядом с package.json
- Module name: `github.com/mewbing/XKeen-UI-Xmeow`
- embed.FS ссылается на dist/ (результат `npm run build`)
- fsnotify (inotify) для реактивного отслеживания лог-файлов
- Ленивый watcher: fsnotify активен только когда есть WS-клиенты
- 1000 строк истории по умолчанию
- Лог-файлы персистентны на диске

### Claude's Discretion
- Конкретный HTTP фреймворк (Chi vs Gin vs stdlib) -- оптимальный для размера бинарника и поддерживаемости
- YAML библиотека для Go (gopkg.in/yaml.v3 или альтернативы)
- SPA serving: embedded файлы + fallback на index.html для SPA routing
- Backup mechanism (идентичный Flask: timestamped copies)
- Exact internal package structure (server/, config/, proxy/, logs/)
- CORS middleware реализация
- Graceful shutdown

### Deferred Ideas (OUT OF SCOPE)
- UPX compression для уменьшения бинарника -- DFRD-04 (отложено на будущее)
- Frontend-only релиз артефакт -- уточнить в Phase 13 (CI/CD)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GOBK-01 | Go binary serves all REST API endpoints identically to Flask (15 endpoints) | Chi v5 routing + полная карта 15 эндпоинтов из server.py |
| GOBK-02 | Go binary streams logs via WebSocket with same protocol | gorilla/websocket + fsnotify lazy watcher pattern |
| GOBK-03 | Go binary embeds SPA frontend via embed.FS | embed.FS + SPA fallback pattern с 404 interception |
| GOBK-04 | Go binary reverse-proxies mihomo API with auth header injection | httputil.ReverseProxy с Rewrite function |
| GOBK-05 | Go binary validates YAML before saving config | goccy/go-yaml Unmarshal в interface{} для syntax validation |
| GOBK-06 | Go binary creates timestamped backups before writes | os.Copy + timestamp format идентичный Flask |
| GOBK-07 | Go binary supports CORS middleware for dev mode | go-chi/cors middleware (fork rs/cors) |
| GOBK-08 | Go binary reads config paths from env vars with defaults | os.Getenv с fallback defaults, идентичные Flask |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go | 1.23+ (1.26 current stable) | Language runtime | Минимальная версия для ServeMux routing enhancements |
| go-chi/chi/v5 | v5.2.5 | HTTP router | Нет внешних зависимостей, middleware grouping, subrouters, 100% совместим с net/http |
| gorilla/websocket | v1.5.3 | WebSocket | Locked decision; стабильный, хорошо документированный, широко используемый |
| goccy/go-yaml | v1.19.2 | YAML parse/validate | Рекомендован как замена архивированного gopkg.in/yaml.v3; лучше compliance с YAML spec |
| fsnotify/fsnotify | v1.9.0 | File watching (inotify) | Cross-platform, 12K+ importers, inotify на Linux |
| go-chi/cors | v1.2.2 | CORS middleware | Штатный CORS для chi, fork rs/cors |

### Supporting (stdlib)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| net/http/httputil | stdlib | Reverse proxy | Проксирование mihomo API с inject auth header |
| embed | stdlib | Embedded filesystem | Встраивание SPA dist/ в бинарник |
| io/fs | stdlib | FS abstraction | Sub-filesystem для embed.FS |
| os/signal | stdlib | Signal handling | Graceful shutdown (SIGTERM/SIGINT) |
| os/exec | stdlib | Process execution | Запуск xkeen -start/-stop/-restart |
| encoding/json | stdlib | JSON encode/decode | Request/response serialization |
| regexp | stdlib | Regex | Log line parsing (2 формата) |
| path/filepath | stdlib | File paths | Работа с путями конфигов |
| time | stdlib | Timestamps | Backup timestamping |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chi v5 | stdlib ServeMux 1.22+ | ServeMux достаточен для routing, но chi дает middleware grouping, subrouters, и NotFound handler для SPA -- критично для нашего случая |
| chi v5 | Gin | Gin тянет зависимости, больше binary size; chi -- zero deps |
| gorilla/websocket | coder/websocket (nhooyr) | coder/websocket более современный (context.Context, concurrent writes), но gorilla -- locked decision и достаточен для нашего простого протокола |
| goccy/go-yaml | gopkg.in/yaml.v3 | yaml.v3 архивирован, не поддерживается; goccy активно развивается |
| fsnotify | polling (time.Ticker) | Polling потребляет CPU; fsnotify использует inotify ядра -- нулевой overhead в idle |

**Installation:**
```bash
# В корне dashboard/
go mod init github.com/mewbing/XKeen-UI-Xmeow
go get github.com/go-chi/chi/v5@v5.2.5
go get github.com/gorilla/websocket@v1.5.3
go get github.com/goccy/go-yaml@v1.19.2
go get github.com/fsnotify/fsnotify@v1.9.0
go get github.com/go-chi/cors@latest
```

## Architecture Patterns

### Recommended Project Structure
```
dashboard/
├── cmd/
│   └── antigravity/
│       └── main.go           # Entry point: config load, server start, graceful shutdown
├── internal/
│   ├── server/
│   │   ├── server.go         # HTTP server setup, chi router, middleware
│   │   └── routes.go         # Route registration (all 15 endpoints + WS)
│   ├── handler/
│   │   ├── health.go         # GET /api/health
│   │   ├── config.go         # GET/PUT /api/config
│   │   ├── xkeen.go          # GET/PUT /api/xkeen/{filename}
│   │   ├── service.go        # POST /api/service/{action}, GET /api/service/status
│   │   ├── versions.go       # GET /api/versions
│   │   ├── system.go         # GET /api/system/cpu, GET /api/system/network
│   │   ├── logs.go           # GET /api/logs/{name}, GET /api/logs/{name}/parsed, POST /api/logs/{name}/clear
│   │   ├── proxies.go        # GET /api/proxies/servers
│   │   └── ws_logs.go        # WS /ws/logs -- WebSocket handler
│   ├── config/
│   │   └── config.go         # App config: env vars, defaults, paths
│   ├── backup/
│   │   └── backup.go         # Timestamped backup creation
│   ├── logwatch/
│   │   └── watcher.go        # fsnotify lazy watcher, log parsing, WS hub
│   ├── proxy/
│   │   └── mihomo.go         # Reverse proxy to mihomo :9090
│   └── spa/
│       └── embed.go          # embed.FS + SPA fallback handler
├── dist/                      # Frontend build output (embedded)
├── go.mod
├── go.sum
├── package.json               # Existing frontend
├── src/                       # Existing frontend source
└── backend/
    └── server.py              # Existing Flask (reference, will be superseded)
```

### Pattern 1: Chi Router with API + SPA
**What:** API routes регистрируются первыми, SPA fallback через NotFound handler
**When to use:** Всегда -- единственный правильный способ совместить API и SPA на одном порте
**Example:**
```go
// Source: go-chi/chi issue #611 + official examples
func NewRouter(handlers *handler.Handlers, spaHandler http.Handler, mihomoProxy http.Handler) *chi.Mux {
    r := chi.NewRouter()

    // Global middleware
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RealIP)

    // CORS (dev mode only)
    if cfg.DevMode {
        r.Use(cors.Handler(cors.Options{
            AllowedOrigins:   []string{"*"},
            AllowedMethods:   []string{"GET", "PUT", "POST", "DELETE", "OPTIONS"},
            AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-API-Key"},
            AllowCredentials: true,
        }))
    }

    // API routes (registered FIRST, before SPA fallback)
    r.Route("/api", func(r chi.Router) {
        r.Get("/health", handlers.Health)
        r.Get("/config", handlers.GetConfig)
        r.Put("/config", handlers.PutConfig)
        r.Get("/xkeen/{filename}", handlers.GetXkeenFile)
        r.Put("/xkeen/{filename}", handlers.PutXkeenFile)
        r.Post("/service/{action}", handlers.ServiceAction)
        r.Get("/service/status", handlers.ServiceStatus)
        r.Get("/versions", handlers.GetVersions)
        r.Get("/system/cpu", handlers.SystemCPU)
        r.Get("/system/network", handlers.SystemNetwork)
        r.Get("/logs/{name}", handlers.GetLogFile)
        r.Get("/logs/{name}/parsed", handlers.GetParsedLog)
        r.Post("/logs/{name}/clear", handlers.ClearLog)
        r.Get("/proxies/servers", handlers.ProxyServers)
    })

    // WebSocket
    r.Get("/ws/logs", handlers.WsLogStream)

    // Optional: reverse proxy to mihomo
    r.Handle("/api/mihomo/*", mihomoProxy)

    // SPA fallback (LAST -- catches all unmatched routes)
    r.NotFound(spaHandler.ServeHTTP)

    return r
}
```

### Pattern 2: SPA Embed with Fallback
**What:** Embedded filesystem с fallback на index.html для client-side routing
**When to use:** Для GOBK-03 -- SPA загрузка из embedded FS
**Example:**
```go
// Source: hackandsla.sh/posts/2021-11-06-serve-spa-from-go/
//go:embed dist/*
var distFS embed.FS

func NewSPAHandler() http.Handler {
    // Strip "dist/" prefix so files are served from root
    sub, _ := fs.Sub(distFS, "dist")
    fileServer := http.FileServer(http.FS(sub))
    indexHTML, _ := fs.ReadFile(distFS, "dist/index.html")

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Try to serve the actual file
        path := r.URL.Path
        if path == "/" {
            path = "index.html"
        } else {
            path = strings.TrimPrefix(path, "/")
        }

        // Check if file exists in embedded FS
        if _, err := fs.Stat(sub, path); err == nil {
            fileServer.ServeHTTP(w, r)
            return
        }

        // Fallback: serve index.html for SPA client-side routing
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
        w.Write(indexHTML)
    })
}
```

### Pattern 3: Lazy fsnotify Watcher for Log Streaming
**What:** fsnotify watcher запускается только при наличии WS клиентов, останавливается при 0 клиентов
**When to use:** GOBK-02 -- WebSocket стриминг логов
**Example:**
```go
// Source: fsnotify docs + project-specific pattern
type LogHub struct {
    mu       sync.RWMutex
    clients  map[*Client]struct{}
    watcher  *fsnotify.Watcher
    logDir   string
}

func (h *LogHub) AddClient(c *Client) {
    h.mu.Lock()
    defer h.mu.Unlock()
    h.clients[c] = struct{}{}
    if len(h.clients) == 1 {
        h.startWatcher() // First client -- start watching
    }
}

func (h *LogHub) RemoveClient(c *Client) {
    h.mu.Lock()
    defer h.mu.Unlock()
    delete(h.clients, c)
    if len(h.clients) == 0 {
        h.stopWatcher() // Last client left -- stop watching
    }
}

func (h *LogHub) startWatcher() {
    var err error
    h.watcher, err = fsnotify.NewWatcher()
    if err != nil { return }
    h.watcher.Add(filepath.Join(h.logDir, "error.log"))
    h.watcher.Add(filepath.Join(h.logDir, "access.log"))
    go h.watchLoop()
}

func (h *LogHub) watchLoop() {
    for {
        select {
        case event, ok := <-h.watcher.Events:
            if !ok { return }
            if event.Has(fsnotify.Write) {
                h.broadcastNewLines(event.Name)
            }
        case _, ok := <-h.watcher.Errors:
            if !ok { return }
        }
    }
}
```

### Pattern 4: Reverse Proxy with Auth Header Injection
**What:** httputil.ReverseProxy с Rewrite для подстановки Authorization header
**When to use:** GOBK-04 -- проксирование mihomo API
**Example:**
```go
// Source: Go stdlib docs, httputil.ReverseProxy
func NewMihomoProxy(target *url.URL, secret string) http.Handler {
    proxy := &httputil.ReverseProxy{
        Rewrite: func(pr *httputil.ProxyRequest) {
            pr.SetURL(target)
            pr.Out.Header.Set("Authorization", "Bearer "+secret)
            // Strip /api/mihomo prefix
            pr.Out.URL.Path = strings.TrimPrefix(pr.Out.URL.Path, "/api/mihomo")
        },
    }
    return http.StripPrefix("/api/mihomo", proxy)
}
```

### Pattern 5: Graceful Shutdown
**What:** signal.NotifyContext + http.Server.Shutdown
**When to use:** Всегда -- корректное завершение при SIGTERM/SIGINT
**Example:**
```go
// Source: Go 1.23+ patterns
func main() {
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    srv := &http.Server{
        Addr:    ":5000",
        Handler: router,
    }

    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("listen: %v", err)
        }
    }()

    <-ctx.Done()
    log.Println("Shutting down...")

    shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    srv.Shutdown(shutdownCtx)
}
```

### Anti-Patterns to Avoid
- **Не использовать Gin:** Тянет зависимости, увеличивает binary size; chi -- zero deps и совместим с net/http
- **Не использовать gopkg.in/yaml.v3:** Архивирован, не поддерживается; использовать goccy/go-yaml
- **Не polling для логов:** Polling через time.Ticker потребляет CPU; fsnotify использует inotify ядра
- **Не Director для reverse proxy:** Использовать Rewrite вместо Director -- безопаснее (Director уязвим к hop-by-hop header manipulation)
- **Не global fsnotify watcher:** Watcher должен быть ленивым (lazy) -- запускается только при наличии WS клиентов
- **Не embed всего проекта:** embed.FS должен ссылаться только на dist/, не на src/ или node_modules/

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP routing | Свой мультиплексор | chi v5 | Middleware grouping, subrouters, NotFound handler для SPA |
| WebSocket | Сырые TCP или net/http Hijack | gorilla/websocket | Полная реализация протокола, tested, upgrades из net/http |
| CORS | Ручные заголовки | go-chi/cors | Edge cases: preflight, credentials, wildcard + credentials запрещено |
| File watching | Polling с time.Ticker | fsnotify | Использует inotify ядра, нулевой overhead в idle |
| Reverse proxy | Ручной HTTP client | httputil.ReverseProxy | Connection pooling, hop-by-hop headers, error handling |
| YAML validation | Regex или ручной парсер | goccy/go-yaml Unmarshal | Полная YAML spec compliance |
| SPA fallback | Ручная проверка файлов | fs.Stat + embed.FS | Корректная обработка content types, caching headers |

**Key insight:** Go stdlib покрывает 80% нужд (embed, httputil, signal, json, os/exec). Внешние зависимости нужны только для WebSocket, YAML, file watching и удобного роутинга.

## Common Pitfalls

### Pitfall 1: GOMIPS=softfloat не установлен при cross-compilation
**What goes wrong:** Бинарник компилируется с hardfloat по умолчанию, на MIPS роутере получаем silent crash или SIGILL
**Why it happens:** GOMIPS defaults to "hardfloat"; Keenetic MIPS роутеры не имеют FPU
**How to avoid:** Всегда устанавливать GOMIPS=softfloat для GOARCH=mips и GOARCH=mipsle
**Warning signs:** Бинарник запускается на amd64 но молча падает на роутере

### Pitfall 2: embed.FS пути включают директорию
**What goes wrong:** `//go:embed dist/*` создает FS с путями `dist/index.html`, а не `index.html`
**Why it happens:** embed.FS сохраняет полную структуру директорий
**How to avoid:** Использовать `fs.Sub(distFS, "dist")` для получения sub-filesystem с корнем в dist/
**Warning signs:** 404 на все статические файлы SPA

### Pitfall 3: WebSocket upgrade через chi требует правильный handler
**What goes wrong:** WebSocket upgrade не работает через chi middleware chain
**Why it happens:** Chi middleware может буферизировать response или менять headers
**How to avoid:** WebSocket handler регистрировать отдельно: `r.Get("/ws/logs", wsHandler)`. Не оборачивать WS-handler в middleware которые пишут в response
**Warning signs:** "websocket: request origin not allowed" или "websocket: the client is not using the websocket protocol"

### Pitfall 4: fsnotify не следит за несуществующими файлами
**What goes wrong:** Watcher.Add() на несуществующий лог-файл возвращает ошибку
**Why it happens:** inotify требует существующий inode для watch
**How to avoid:** Перед Add() проверять существование файла; если нет -- следить за директорией и добавлять файл при создании
**Warning signs:** "no such file or directory" при запуске watcher

### Pitfall 5: JSON response format несовместим с фронтендом
**What goes wrong:** Фронтенд получает ошибку парсинга или неожиданные поля
**Why it happens:** Go json.Marshal по умолчанию использует PascalCase, Flask отдает snake_case
**How to avoid:** Использовать `json:"field_name"` теги на всех struct полях, точно повторяя Flask формат
**Warning signs:** Фронтенд показывает undefined вместо данных

### Pitfall 6: os/exec.Command и PATH на роутере
**What goes wrong:** `exec.Command("xkeen", "-start")` не находит бинарник
**Why it happens:** PATH на Entware роутере может не включать /opt/sbin
**How to avoid:** Использовать полный путь из env var XKEEN_BIN (как Flask), default `/opt/sbin/xkeen`
**Warning signs:** "exec: xkeen: executable file not found in $PATH"

### Pitfall 7: CPU usage reading /proc/stat требует delta
**What goes wrong:** CPU usage всегда показывает 0% или 100%
**Why it happens:** /proc/stat дает кумулятивные значения, нужна разница между двумя чтениями
**How to avoid:** Хранить предыдущее чтение в struct (как Flask _prev_cpu), вычислять delta
**Warning signs:** Первый вызов всегда возвращает 0 (нет предыдущих данных)

### Pitfall 8: Concurrent map writes в WS hub
**What goes wrong:** Panic: "concurrent map iteration and map write"
**Why it happens:** Несколько goroutines одновременно добавляют/удаляют клиентов и broadcast
**How to avoid:** sync.RWMutex на map клиентов; или channel-based hub pattern
**Warning signs:** Спорадические panic при подключении/отключении WS клиентов

## Code Examples

### Complete API Endpoint: GET/PUT Config (GOBK-01, GOBK-05, GOBK-06)
```go
// Source: Портирование из backend/server.py lines 247-292
type ConfigHandler struct {
    configPath string
    backupDir  string
}

func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
    content, err := os.ReadFile(h.configPath)
    if err != nil {
        if os.IsNotExist(err) {
            writeJSON(w, http.StatusNotFound, map[string]string{"error": "Config file not found"})
            return
        }
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"content": string(content)})
}

func (h *ConfigHandler) PutConfig(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Content string `json:"content"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
        writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing \"content\" field in request body"})
        return
    }

    // Step 1: Validate YAML syntax
    var parsed interface{}
    if err := yaml.Unmarshal([]byte(body.Content), &parsed); err != nil {
        writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("Invalid YAML: %v", err)})
        return
    }

    // Step 2: Backup existing config
    backupPath, err := createBackup(h.configPath, "config", ".yaml", h.backupDir)
    if err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Backup failed: %v", err)})
        return
    }

    // Step 3: Write new config
    if err := os.MkdirAll(filepath.Dir(h.configPath), 0755); err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Write failed: %v", err)})
        return
    }
    if err := os.WriteFile(h.configPath, []byte(body.Content), 0644); err != nil {
        writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Write failed: %v", err)})
        return
    }

    writeJSON(w, http.StatusOK, map[string]interface{}{
        "message": "Config saved",
        "backup":  backupPath,
    })
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}
```

### WebSocket Log Stream Handler (GOBK-02)
```go
// Source: Портирование протокола из backend/server.py lines 549-640
// + useLogWebSocket.ts protocol
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true }, // CORS handled by middleware
}

func (h *WsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil { return }

    client := &Client{
        conn:        conn,
        currentFile: "error",
    }

    h.hub.AddClient(client)
    defer h.hub.RemoveClient(client)

    // Send initial content
    lines, offset := h.readLogTail(client.currentFile, 1000)
    client.sendJSON(map[string]interface{}{
        "type":  "initial",
        "lines": lines,
        "file":  client.currentFile,
    })
    client.offset = offset

    // Read loop
    for {
        _, message, err := conn.ReadMessage()
        if err != nil { break }

        var msg struct {
            Type string `json:"type"`
            File string `json:"file"`
        }
        if json.Unmarshal(message, &msg) != nil { continue }

        switch msg.Type {
        case "switchFile":
            f := strings.TrimSuffix(msg.File, ".log")
            if _, ok := allowedLogs[f]; ok {
                client.currentFile = f
            }
            lines, offset := h.readLogTail(client.currentFile, 1000)
            client.sendJSON(map[string]interface{}{
                "type": "initial", "lines": lines, "file": client.currentFile,
            })
            client.offset = offset

        case "reload":
            lines, offset := h.readLogTail(client.currentFile, 1000)
            client.sendJSON(map[string]interface{}{
                "type": "initial", "lines": lines, "file": client.currentFile,
            })
            client.offset = offset

        case "clear":
            h.clearLog(client.currentFile)
            client.sendJSON(map[string]string{"type": "clear"})
            client.offset = 0

        case "ping":
            client.sendJSON(map[string]string{"type": "pong"})
        }
    }
}
```

### Log Line Parser (Портирование regex из Flask)
```go
// Source: backend/server.py lines 473-508
var (
    stripANSI = regexp.MustCompile(`(?:\x1b\[|0\[)\d+m`)
    logV5     = regexp.MustCompile(`time="([^"]+)"\s+level=(\w+)\s+msg="(.+)"$`)
    logPlain  = regexp.MustCompile(`(?i)^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+(INFO|WARN|WARNING|ERROR|DEBUG)\s+(.+)$`)
)

type LogLine struct {
    Time  *string `json:"time"`
    Level *string `json:"level"`
    Msg   string  `json:"msg"`
}

func parseLogLine(raw string) *LogLine {
    clean := stripANSI.ReplaceAllString(raw, "")
    clean = strings.TrimSpace(clean)
    if clean == "" { return nil }

    if m := logV5.FindStringSubmatch(clean); m != nil {
        ts := m[1]
        if idx := strings.Index(ts, "T"); idx >= 0 {
            ts = ts[idx+1:]
            if len(ts) > 8 { ts = ts[:8] }
        }
        level := strings.ToLower(m[2])
        return &LogLine{Time: &ts, Level: &level, Msg: m[3]}
    }

    if m := logPlain.FindStringSubmatch(clean); m != nil {
        parts := strings.Fields(m[1])
        ts := parts[len(parts)-1]
        if len(ts) > 8 { ts = ts[:8] }
        level := strings.ToLower(m[2])
        return &LogLine{Time: &ts, Level: &level, Msg: m[3]}
    }

    // Unstructured line (xkeen status) -- preserve ANSI if present
    rawTrimmed := strings.TrimSpace(raw)
    if strings.Contains(rawTrimmed, "\x1b[") {
        return &LogLine{Msg: rawTrimmed}
    }
    return &LogLine{Msg: clean}
}
```

### App Config from Environment (GOBK-08)
```go
// Source: Портирование из backend/server.py lines 41-48
type AppConfig struct {
    MihomoConfigPath string
    XkeenDir         string
    BackupDir        string
    XkeenBin         string
    XkeenLogDir      string
    Port             int
    DevMode          bool
}

func LoadConfig() *AppConfig {
    return &AppConfig{
        MihomoConfigPath: getEnv("MIHOMO_CONFIG_PATH", "/opt/etc/mihomo/config.yaml"),
        XkeenDir:         getEnv("XKEEN_DIR", "/opt/etc/xkeen"),
        BackupDir:        getEnv("BACKUP_DIR", "/opt/etc/mihomo/backups"),
        XkeenBin:         getEnv("XKEEN_BIN", "/opt/sbin/xkeen"),
        XkeenLogDir:      getEnv("XKEEN_LOG_DIR", "/opt/var/log/xray"),
        Port:             getEnvInt("PORT", 5000),
        DevMode:          getEnv("DEV_MODE", "") != "",
    }
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" { return v }
    return fallback
}
```

### Backup Mechanism (GOBK-06)
```go
// Source: Портирование из backend/server.py lines 58-74
func createBackup(sourcePath, backupName, extension, backupDir string) (string, error) {
    if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
        return "", nil
    }
    if err := os.MkdirAll(backupDir, 0755); err != nil {
        return "", err
    }
    timestamp := time.Now().Format("20060102_150405")
    backupPath := filepath.Join(backupDir, fmt.Sprintf("%s_%s%s", backupName, timestamp, extension))

    src, err := os.ReadFile(sourcePath)
    if err != nil { return "", err }
    if err := os.WriteFile(backupPath, src, 0644); err != nil {
        return "", err
    }
    return backupPath, nil
}
```

## Complete API Endpoint Map

Полная карта 15 эндпоинтов Flask -> Go (из backend/server.py):

| # | Method | Path | Flask handler | Response format | Notes |
|---|--------|------|---------------|-----------------|-------|
| 1 | GET | /api/health | health() | `{"status":"ok"}` | |
| 2 | POST | /api/service/{action} | service_action(action) | `{"status":"ok"}` or `{"error":"..."}` | action: start/stop/restart |
| 3 | GET | /api/service/status | service_status() | `{"running":bool,"pid":int\|null}` | pidof mihomo/xray |
| 4 | GET | /api/versions | get_versions() | `{"xkeen":"...","dashboard":"..."}` | |
| 5 | GET | /api/config | get_config() | `{"content":"..."}` | |
| 6 | PUT | /api/config | put_config() | `{"message":"...","backup":"..."}` | YAML validate + backup |
| 7 | GET | /api/xkeen/{filename} | get_xkeen_file(fn) | `{"content":"...","filename":"..."}` | |
| 8 | PUT | /api/xkeen/{filename} | put_xkeen_file(fn) | `{"message":"..."}` | backup before write |
| 9 | GET | /api/system/cpu | system_cpu() | `{"cpu":float}` | delta calculation |
| 10 | GET | /api/system/network | system_network() | `{"ip":"...","info":{...},"uptime":int}` | curl external APIs |
| 11 | GET | /api/logs/{name} | get_log_file(name) | `{"content":"...","size":int}` | name: error/access |
| 12 | GET | /api/logs/{name}/parsed | get_parsed_log(name) | `{"lines":[...],"size":int}` | parsed log lines |
| 13 | POST | /api/logs/{name}/clear | clear_log_file(name) | `{"status":"ok"}` | truncate log |
| 14 | GET | /api/proxies/servers | proxy_servers() | `{"name":"server:port",...}` | from config.yaml |
| 15 | WS | /ws/logs | ws_log_stream(ws) | JSON messages | bidirectional |

## WebSocket Protocol Reference

Из useLogWebSocket.ts и backend/server.py:

| Direction | Type | Payload | Trigger |
|-----------|------|---------|---------|
| Server->Client | initial | `{type:"initial", lines:[{time,level,msg}], file:"error"}` | Connect, switchFile, reload |
| Server->Client | append | `{type:"append", lines:[{time,level,msg}]}` | New log lines detected |
| Server->Client | clear | `{type:"clear"}` | Client sent clear |
| Server->Client | pong | `{type:"pong"}` | Client sent ping |
| Client->Server | switchFile | `{type:"switchFile", file:"access"}` | User switches log tab |
| Client->Server | reload | `{type:"reload"}` | User clicks reload |
| Client->Server | clear | `{type:"clear"}` | User clicks clear |
| Client->Server | ping | `{type:"ping"}` | Keepalive every 30s |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gopkg.in/yaml.v3 | goccy/go-yaml | 2024-2025 | yaml.v3 архивирован; goccy активно поддерживается |
| net/http DefaultServeMux | Go 1.22+ ServeMux с method routing | Go 1.22 (Feb 2024) | Можно использовать stdlib для basic routing |
| Director в ReverseProxy | Rewrite в ReverseProxy | Go 1.20 | Rewrite безопаснее: защита от hop-by-hop manipulation |
| gorilla/websocket (sole option) | gorilla + coder/websocket (nhooyr) | 2024 | Два жизнеспособных варианта; gorilla стабилен |
| Polling лог-файлов | fsnotify (inotify) | Давно | Нулевой overhead в idle |

**Deprecated/outdated:**
- gopkg.in/yaml.v3: Архивирован, не получает обновлений. Использовать goccy/go-yaml.
- httputil.ReverseProxy Director: Уязвим к hop-by-hop header manipulation. Использовать Rewrite.
- gorilla/mux: Archived, не поддерживается. Использовать chi v5 или stdlib ServeMux.

## Open Questions

1. **Auth middleware scope**
   - What we know: API key берется из mihomo config.yaml поле `secret`; фронтенд отправляет его через Authorization header
   - What's unclear: Нужно ли защищать ВСЕ эндпоинты (включая /api/health) или только мутирующие (PUT/POST)?
   - Recommendation: Защитить все /api/* эндпоинты кроме /api/health (health check должен работать без auth для мониторинга). SPA serving (/) -- без auth.

2. **fsnotify на Entware (Keenetic)**
   - What we know: fsnotify использует inotify на Linux; Keenetic роутеры работают на Linux kernel
   - What's unclear: Поддерживает ли Entware kernel inotify? (Скорее всего да, но нужна проверка)
   - Recommendation: Реализовать fallback на polling (time.Ticker, 500ms) если fsnotify.NewWatcher() возвращает ошибку

3. **Binary size на MIPS**
   - What we know: Go бинарник ~13-17 МБ с ldflags "-s -w"; целевой размер из CONTEXT.md
   - What's unclear: Точный размер с нашим набором зависимостей (chi + gorilla/ws + goccy/yaml + fsnotify)
   - Recommendation: После первого рабочего билда измерить размер для каждой архитектуры. Если >20 МБ -- рассмотреть оптимизацию (tinygo не вариант из-за зависимостей, но ldflags "-s -w" обязательны)

4. **mihomo config reading при старте**
   - What we know: Go читает `secret` и `external-controller` из mihomo config.yaml
   - What's unclear: Что делать если mihomo config не существует при старте Go backend?
   - Recommendation: Логировать warning, работать без auth и без reverse proxy; перечитывать при каждом PUT /api/config

## Sources

### Primary (HIGH confidence)
- [go-chi/chi v5](https://github.com/go-chi/chi) -- router, middleware, subrouters, SPA pattern (issue #611)
- [gorilla/websocket](https://github.com/gorilla/websocket) -- v1.5.3, actively maintained, stable API
- [goccy/go-yaml](https://github.com/goccy/go-yaml) -- v1.19.2, recommended replacement for yaml.v3
- [fsnotify](https://github.com/fsnotify/fsnotify) -- v1.9.0, cross-platform file watching
- [Go embed package](https://pkg.go.dev/embed) -- official docs for embed.FS
- [Go httputil.ReverseProxy](https://pkg.go.dev/net/http/httputil) -- Rewrite function pattern
- [Go 1.22 routing enhancements](https://go.dev/blog/routing-enhancements) -- method matching, wildcards
- [Go 1.26 release](https://go.dev/doc/go1.26) -- current stable version
- backend/server.py -- полный эталон всех 15 REST эндпоинтов + WS протокол
- src/lib/config-api.ts -- TypeScript API клиент, контракт запросов/ответов
- src/hooks/useLogWebSocket.ts -- WS протокол клиента

### Secondary (MEDIUM confidence)
- [SPA from Go with embed.FS](https://hackandsla.sh/posts/2021-11-06-serve-spa-from-go/) -- 404 interception pattern
- [Go graceful shutdown patterns](https://victoriametrics.com/blog/go-graceful-shutdown/) -- signal.NotifyContext
- [Chi vs ServeMux comparison](https://www.calhoun.io/go-servemux-vs-chi/) -- when to use chi vs stdlib
- [Go MIPS cross-compilation](https://go.dev/wiki/GoMips) -- GOMIPS=softfloat requirement
- [coder/websocket](https://github.com/coder/websocket) -- modern alternative (not used, but noted)

### Tertiary (LOW confidence)
- Binary size estimates (13-17 МБ) -- from CONTEXT.md user estimate, needs verification after build

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- все библиотеки верифицированы через GitHub releases, pkg.go.dev
- Architecture: HIGH -- patterns из official docs и verified community examples
- Pitfalls: HIGH -- основаны на documented issues (GOMIPS, embed.FS paths, concurrent maps)
- API contract: HIGH -- полностью документирован из исходного кода (server.py + config-api.ts)
- fsnotify on Entware: MEDIUM -- inotify стандартен для Linux, но Keenetic kernel может отличаться

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days -- stable ecosystem, no fast-moving dependencies)
