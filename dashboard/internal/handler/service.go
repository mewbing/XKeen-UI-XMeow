package handler

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// logMaxLines is the maximum number of lines to keep in the log file
// before a new service action. Identical to Flask LOG_MAX_LINES = 200.
const logMaxLines = 200

// trimLogFile keeps only the last maxLines in the log file.
// Identical to Flask _trim_log_file function.
func trimLogFile(path string, maxLines int) {
	data, err := os.ReadFile(path)
	if err != nil {
		return // File not found or unreadable -- ignore
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) <= maxLines {
		return
	}

	// Keep only last maxLines
	trimmed := strings.Join(lines[len(lines)-maxLines:], "\n")
	os.WriteFile(path, []byte(trimmed), 0644) //nolint:errcheck
}

// ServiceAction handles POST /api/service/{action} -- start, stop, or restart xkeen.
// Response: 200 {"status": "ok"} | 400 {"error": "..."} | 500 {"error": "..."}
func (h *Handlers) ServiceAction(w http.ResponseWriter, r *http.Request) {
	action := chi.URLParam(r, "action")
	if action != "start" && action != "stop" && action != "restart" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Invalid action. Must be start, stop, or restart",
		})
		return
	}

	// Log path: error.log in xkeen log dir
	logPath := filepath.Join(h.cfg.XkeenLogDir, "error.log")

	// Ensure log directory exists
	if err := os.MkdirAll(h.cfg.XkeenLogDir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Cannot create log dir: %v", err),
		})
		return
	}

	// Trim log file before writing
	trimLogFile(logPath, logMaxLines)

	// Open log file in append mode for stdout+stderr
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Cannot open log file: %v", err),
		})
		return
	}
	defer logFile.Close()

	// Execute xkeen with full path from config (NOT bare "xkeen" -- PATH may not include /opt/sbin)
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, h.cfg.XkeenBin, "-"+action)
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Command timed out",
			})
			return
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Command exited with code %d", exitErr.ExitCode()),
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ServiceStatus returns whether xkeen (mihomo/xray) is running and its PID.
// Response: 200 {"running": true, "pid": 12345} | 200 {"running": false, "pid": null}
func (h *Handlers) ServiceStatus(w http.ResponseWriter, r *http.Request) {
	for _, procName := range []string{"mihomo", "xray"} {
		out, err := exec.Command("pidof", procName).Output()
		if err != nil {
			continue
		}
		pidStr := strings.TrimSpace(string(out))
		if pidStr == "" {
			continue
		}
		// Parse first PID from output (pidof may return multiple)
		firstPid := strings.Fields(pidStr)[0]
		pid, err := strconv.Atoi(firstPid)
		if err != nil {
			continue
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"running": true,
			"pid":     pid,
		})
		return
	}

	// Not running -- pid must be JSON null
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"running": false,
		"pid":     nil,
	})
}
