//go:build !linux

package updater

// checkDiskSpace is a no-op on non-Linux platforms.
// The production binary only runs on Linux (Keenetic router).
func checkDiskSpace(_ string, _ int64) error {
	return nil
}
