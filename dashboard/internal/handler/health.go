package handler

import (
	"net/http"
)

// Health returns {"status": "ok"} with 200 status code.
func Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
