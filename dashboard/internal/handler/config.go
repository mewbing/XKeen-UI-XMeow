package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/goccy/go-yaml"

	"github.com/mewbing/XKeen-UI-XMeow/internal/backup"
)

// GetConfig returns the mihomo config.yaml content as JSON.
// Response: 200 {"content": "..."} | 404 {"error": "Config file not found"} | 500 {"error": "..."}
func (h *Handlers) GetConfig(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(h.cfg.MihomoConfigPath)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Config file not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": string(data)})
}

// PutConfig validates YAML, creates a backup, and saves new config.
// Request: {"content": "..."}
// Response: 200 {"message": "Config saved", "backup": "path"} | 400 | 500
func (h *Handlers) PutConfig(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Content *string `json:"content"`
	}
	if err := readJSONBody(r, &body); err != nil || body.Content == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": `Missing "content" field in request body`,
		})
		return
	}

	// Validate YAML
	var parsed interface{}
	if err := yaml.Unmarshal([]byte(*body.Content), &parsed); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Invalid YAML: %v", err),
		})
		return
	}

	// Backup existing config
	backupPath, err := backup.CreateBackup(h.cfg.MihomoConfigPath, "config", ".yaml", h.cfg.BackupDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Backup failed: %v", err),
		})
		return
	}

	// Write new config
	dir := filepath.Dir(h.cfg.MihomoConfigPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Write failed: %v", err),
		})
		return
	}
	if err := os.WriteFile(h.cfg.MihomoConfigPath, []byte(*body.Content), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Write failed: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Config saved",
		"backup":  backupPath,
	})
}
