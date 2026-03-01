package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"

	"github.com/mewbing/XKeen-UI-Xmeow/internal/backup"
)

// GetXkeenFile returns the content of an xkeen list file.
// Response: 200 {"content": "...", "filename": "ip_exclude.lst"} | 404 {"error": "Unknown file"}
func (h *Handlers) GetXkeenFile(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")

	actualFilename, ok := h.cfg.XkeenFiles[filename]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Unknown file"})
		return
	}

	filePath := filepath.Join(h.cfg.XkeenDir, actualFilename)
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// File not found is not an error -- return empty content (identical to Flask)
			writeJSON(w, http.StatusOK, map[string]string{
				"content":  "",
				"filename": actualFilename,
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"content":  string(data),
		"filename": actualFilename,
	})
}

// PutXkeenFile creates a backup and saves new xkeen list file content.
// Request: {"content": "..."}
// Response: 200 {"message": "{filename} saved"} | 400 | 404 | 500
func (h *Handlers) PutXkeenFile(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")

	actualFilename, ok := h.cfg.XkeenFiles[filename]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Unknown file"})
		return
	}

	var body struct {
		Content *string `json:"content"`
	}
	if err := readJSONBody(r, &body); err != nil || body.Content == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": `Missing "content" field in request body`,
		})
		return
	}

	filePath := filepath.Join(h.cfg.XkeenDir, actualFilename)

	// Backup existing file
	if _, err := backup.CreateBackup(filePath, filename, ".lst", h.cfg.BackupDir); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Backup failed: %v", err),
		})
		return
	}

	// Write new content
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Write failed: %v", err),
		})
		return
	}
	if err := os.WriteFile(filePath, []byte(*body.Content), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Write failed: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("%s saved", filename),
	})
}
