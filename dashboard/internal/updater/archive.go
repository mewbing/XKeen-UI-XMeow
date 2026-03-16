package updater

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const maxExtractSize = 100 * 1024 * 1024 // 100 MB limit per file (decompression bomb protection)

// ExtractBinaryFromTarGz extracts a single named binary from a tar.gz archive.
// The extracted file is written to a hidden temp file in destDir (same FS for atomic rename).
// Returns the path to the extracted temp file.
func ExtractBinaryFromTarGz(archivePath, targetName, destDir string) (string, error) {
	f, err := os.Open(archivePath)
	if err != nil {
		return "", fmt.Errorf("open archive: %w", err)
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return "", fmt.Errorf("gzip reader: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("read tar entry: %w", err)
		}

		// Strip directory prefix for security (only match base name)
		cleanName := filepath.Base(hdr.Name)
		if cleanName != targetName {
			continue
		}

		// Write to hidden temp file in the same directory (for same-FS rename)
		tmpPath := filepath.Join(destDir, "."+targetName+".new")
		out, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
		if err != nil {
			return "", fmt.Errorf("create temp file: %w", err)
		}

		_, copyErr := io.Copy(out, io.LimitReader(tr, maxExtractSize))
		closeErr := out.Close()

		if copyErr != nil {
			os.Remove(tmpPath)
			return "", fmt.Errorf("extract %s: %w", targetName, copyErr)
		}
		if closeErr != nil {
			os.Remove(tmpPath)
			return "", fmt.Errorf("close temp file: %w", closeErr)
		}

		return tmpPath, nil
	}

	return "", fmt.Errorf("file %q not found in archive", targetName)
}

// VerifyChecksum verifies the SHA256 hash of a file against a checksums.txt file.
// checksumPath is the local path to checksums.txt, archiveName is the expected filename entry.
func VerifyChecksum(archivePath, checksumPath, archiveName string) error {
	// Parse checksums.txt (format: "{hash}  {filename}" per line, sha256sum output)
	data, err := os.ReadFile(checksumPath)
	if err != nil {
		return fmt.Errorf("read checksums file: %w", err)
	}

	var expectedHash string
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[1] == archiveName {
			expectedHash = fields[0]
			break
		}
	}
	if expectedHash == "" {
		return fmt.Errorf("checksum for %s not found in checksums.txt", archiveName)
	}

	// Compute actual SHA256 of the downloaded archive
	f, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open archive for checksum: %w", err)
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("compute checksum: %w", err)
	}
	actualHash := hex.EncodeToString(h.Sum(nil))

	if actualHash != expectedHash {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedHash, actualHash)
	}

	return nil
}

// ExtractDistTarGz extracts all files from a dist.tar.gz archive into destDir.
// Used for extracting SPA files in external-ui mode.
// Includes zip-slip protection and per-file size limits.
func ExtractDistTarGz(archivePath, destDir string) error {
	f, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open dist archive: %w", err)
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("gzip reader: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	// Ensure destDir is clean for prefix checking (zip-slip protection)
	cleanDest := filepath.Clean(destDir)

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read tar entry: %w", err)
		}

		// Construct target path and validate against zip-slip
		// Allow exact match (e.g., "./" resolves to destDir itself)
		target := filepath.Clean(filepath.Join(destDir, hdr.Name))
		if target != cleanDest && !strings.HasPrefix(target, cleanDest+string(os.PathSeparator)) {
			return fmt.Errorf("zip slip detected: %s escapes %s", hdr.Name, destDir)
		}

		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return fmt.Errorf("create directory %s: %w", target, err)
			}

		case tar.TypeReg:
			// Ensure parent directory exists
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return fmt.Errorf("create parent dir for %s: %w", target, err)
			}

			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode)&0755)
			if err != nil {
				return fmt.Errorf("create file %s: %w", target, err)
			}

			_, copyErr := io.Copy(out, io.LimitReader(tr, maxExtractSize))
			closeErr := out.Close()

			if copyErr != nil {
				return fmt.Errorf("extract %s: %w", hdr.Name, copyErr)
			}
			if closeErr != nil {
				return fmt.Errorf("close %s: %w", hdr.Name, closeErr)
			}
		}
	}

	return nil
}
