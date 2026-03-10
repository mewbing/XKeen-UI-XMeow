package updater

import (
	"fmt"

	"golang.org/x/sys/unix"
)

// checkDiskSpace verifies that the filesystem containing path has enough free space.
// Minimum required is max(requiredBytes, 20MB).
func CheckDiskSpace(path string, requiredBytes int64) error {
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return fmt.Errorf("cannot check disk space: %w", err)
	}

	available := int64(stat.Bavail) * int64(stat.Bsize)

	// Enforce minimum 20MB even if requiredBytes is smaller
	const minRequired = 20 * 1024 * 1024
	if requiredBytes < minRequired {
		requiredBytes = minRequired
	}

	if available < requiredBytes {
		return fmt.Errorf("insufficient disk space: need %d MB, have %d MB",
			requiredBytes/1024/1024, available/1024/1024)
	}
	return nil
}
