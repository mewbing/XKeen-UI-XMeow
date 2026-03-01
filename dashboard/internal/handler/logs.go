package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/logwatch"
)

// GetLogFile returns raw log content for GET /api/logs/{name}.
// Query params: lines (default 200, max 2000), offset (default 0).
func (h *Handlers) GetLogFile(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if _, ok := h.cfg.AllowedLogs[name]; !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Unknown log: " + name + ". Allowed: [error, access]",
		})
		return
	}

	maxLines := 200
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxLines = n
		}
	}
	if maxLines > 2000 {
		maxLines = 2000
	}

	var offset int64
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			offset = n
		}
	}

	content, size, err := logwatch.ReadLogRaw(h.cfg.XkeenLogDir, name, h.cfg.AllowedLogs, maxLines, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"content": content,
		"size":    size,
	})
}

// GetParsedLog returns parsed log lines for GET /api/logs/{name}/parsed.
// Query param: lines (default 500, max 2000).
func (h *Handlers) GetParsedLog(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if _, ok := h.cfg.AllowedLogs[name]; !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Unknown log: " + name,
		})
		return
	}

	maxLines := 500
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxLines = n
		}
	}
	if maxLines > 2000 {
		maxLines = 2000
	}

	lines, size := logwatch.ReadLogTail(h.cfg.XkeenLogDir, name, h.cfg.AllowedLogs, maxLines)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"lines": lines,
		"size":  size,
	})
}

// ClearLog truncates a log file for POST /api/logs/{name}/clear.
func (h *Handlers) ClearLog(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if _, ok := h.cfg.AllowedLogs[name]; !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "Unknown log: " + name,
		})
		return
	}

	if err := logwatch.ClearLog(h.cfg.XkeenLogDir, name, h.cfg.AllowedLogs); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ok",
	})
}
