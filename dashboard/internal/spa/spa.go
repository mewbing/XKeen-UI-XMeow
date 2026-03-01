package spa

import (
	"io/fs"
	"net/http"
	"strings"
)

// NewSPAHandler creates an http.Handler that serves SPA files from the given
// embedded filesystem. It accepts an fs.FS parameter (the root embed.FS
// containing the dist/ directory).
//
// For known files (JS, CSS, images, etc.), it serves them directly.
// For unknown paths (SPA client-side routes), it serves index.html.
func NewSPAHandler(distFS fs.FS) http.Handler {
	// Strip the "dist/" prefix so files are served from root
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("spa: failed to create sub-filesystem: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(sub))

	// Pre-read index.html content at init time for SPA fallback
	indexHTML, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		panic("spa: failed to read index.html: " + err.Error())
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Normalize path
		path := r.URL.Path
		if path == "/" {
			// Serve index.html directly for root
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Write(indexHTML)
			return
		}

		// Remove leading slash for fs.Stat
		cleanPath := strings.TrimPrefix(path, "/")

		// Check if file exists in embedded FS
		if _, err := fs.Stat(sub, cleanPath); err == nil {
			// File exists -- serve it via file server
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback: serve index.html for SPA client-side routing
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Write(indexHTML)
	})
}
