package logwatch

import (
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher monitors log files for changes using fsnotify with a polling fallback.
// If fsnotify fails (e.g., inotify unavailable on Entware), falls back to polling.
type Watcher struct {
	fsw          *fsnotify.Watcher // nil if fsnotify fails
	ticker       *time.Ticker      // polling fallback
	stopCh       chan struct{}
	hub          *LogHub
	logDir       string
	allowedLogs  map[string]string
	usingPolling bool
	wg           sync.WaitGroup

	// For polling: track file sizes to detect changes
	fileSizes map[string]int64
}

// NewWatcher creates a file watcher. Tries fsnotify first, falls back to polling.
func NewWatcher(hub *LogHub, logDir string, allowedLogs map[string]string) *Watcher {
	w := &Watcher{
		stopCh:      make(chan struct{}),
		hub:         hub,
		logDir:      logDir,
		allowedLogs: allowedLogs,
		fileSizes:   make(map[string]int64),
	}

	// Try fsnotify
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("[Watcher] fsnotify unavailable (%v), using polling fallback (500ms)", err)
		w.usingPolling = true
		w.ticker = time.NewTicker(500 * time.Millisecond)
		return w
	}

	w.fsw = fsw

	// Add log files or directory to watcher
	for _, filename := range allowedLogs {
		filePath := filepath.Join(logDir, filename)
		if _, err := os.Stat(filePath); err == nil {
			// File exists, watch it directly
			if err := fsw.Add(filePath); err != nil {
				log.Printf("[Watcher] Failed to watch %s: %v", filePath, err)
			}
		}
	}

	// Also watch the directory to catch file creation
	if _, err := os.Stat(logDir); err == nil {
		if err := fsw.Add(logDir); err != nil {
			log.Printf("[Watcher] Failed to watch directory %s: %v", logDir, err)
		}
	}

	return w
}

// Start begins watching for file changes in a goroutine.
func (w *Watcher) Start() {
	w.wg.Add(1)
	if w.usingPolling {
		go w.pollLoop()
	} else {
		go w.fsnotifyLoop()
	}
}

// Stop signals the watcher to stop and waits for the goroutine to exit.
func (w *Watcher) Stop() {
	close(w.stopCh)
	if w.fsw != nil {
		w.fsw.Close()
	}
	if w.ticker != nil {
		w.ticker.Stop()
	}
	w.wg.Wait()
}

// fsnotifyLoop watches for file system events.
func (w *Watcher) fsnotifyLoop() {
	defer w.wg.Done()

	for {
		select {
		case <-w.stopCh:
			return

		case event, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			baseName := filepath.Base(event.Name)

			if event.Has(fsnotify.Write) {
				// Check if this is an allowed log file
				if filenameToLogName(baseName, w.allowedLogs) != "" {
					w.hub.BroadcastNewLines(event.Name)
				}
			}

			if event.Has(fsnotify.Create) {
				// If a new file is created that matches an allowed log, add it to watcher
				if filenameToLogName(baseName, w.allowedLogs) != "" {
					if err := w.fsw.Add(event.Name); err != nil {
						log.Printf("[Watcher] Failed to add new file %s: %v", event.Name, err)
					} else {
						log.Printf("[Watcher] Now watching newly created %s", event.Name)
					}
				}
			}

		case err, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
			log.Printf("[Watcher] fsnotify error: %v", err)
		}
	}
}

// pollLoop checks file sizes periodically to detect changes.
func (w *Watcher) pollLoop() {
	defer w.wg.Done()

	// Initialize file sizes
	for _, filename := range w.allowedLogs {
		filePath := filepath.Join(w.logDir, filename)
		if info, err := os.Stat(filePath); err == nil {
			w.fileSizes[filePath] = info.Size()
		}
	}

	for {
		select {
		case <-w.stopCh:
			return

		case <-w.ticker.C:
			for _, filename := range w.allowedLogs {
				filePath := filepath.Join(w.logDir, filename)
				info, err := os.Stat(filePath)
				if err != nil {
					// File might not exist yet
					if prevSize, ok := w.fileSizes[filePath]; ok && prevSize > 0 {
						// File was deleted/truncated
						w.fileSizes[filePath] = 0
						w.hub.BroadcastNewLines(filePath)
					}
					continue
				}

				currentSize := info.Size()
				prevSize := w.fileSizes[filePath]

				if currentSize != prevSize {
					w.fileSizes[filePath] = currentSize
					w.hub.BroadcastNewLines(filePath)
				}
			}
		}
	}
}
