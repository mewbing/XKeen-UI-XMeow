package backup

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// CreateBackup creates a timestamped backup of the source file.
// If the source file does not exist, returns ("", nil) -- no error, no backup.
// The backup is written to {backupDir}/{backupName}_{YYYYMMDD_HHMMSS}{extension}.
// Timestamp format is identical to Flask: time.Now().Format("20060102_150405").
func CreateBackup(sourcePath, backupName, extension, backupDir string) (string, error) {
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return "", nil
	}

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", fmt.Errorf("create backup dir: %w", err)
	}

	src, err := os.ReadFile(sourcePath)
	if err != nil {
		return "", fmt.Errorf("read source: %w", err)
	}

	timestamp := time.Now().Format("20060102_150405")
	backupPath := filepath.Join(backupDir, fmt.Sprintf("%s_%s%s", backupName, timestamp, extension))

	if err := os.WriteFile(backupPath, src, 0644); err != nil {
		return "", fmt.Errorf("write backup: %w", err)
	}

	return backupPath, nil
}
