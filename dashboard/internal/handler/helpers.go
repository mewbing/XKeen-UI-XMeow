package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// writeJSON writes a JSON response with the given status code and data.
// Sets Content-Type to application/json.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// readJSONBody decodes the request body into v.
// Returns an error if the body is malformed or cannot be decoded.
func readJSONBody(r *http.Request, v interface{}) error {
	if r.Body == nil {
		return fmt.Errorf("empty request body")
	}
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(v); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}
