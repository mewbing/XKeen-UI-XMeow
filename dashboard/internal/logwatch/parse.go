package logwatch

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// LogLine represents a parsed log line with optional time and level fields.
// Matches the JSON format expected by the frontend (WsLogLine interface).
type LogLine struct {
	Time  *string `json:"time"`
	Level *string `json:"level"`
	Msg   string  `json:"msg"`
}

// Regex patterns identical to Flask server.py lines 473-508.
var (
	stripANSI = regexp.MustCompile(`(?:\x1b\[|0\[)\d+m`)
	logV5     = regexp.MustCompile(`time="([^"]+)"\s+level=(\w+)\s+msg="(.+)"$`)
	logPlain  = regexp.MustCompile(`(?i)^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+(INFO|WARN|WARNING|ERROR|DEBUG)\s+(.+)$`)
)

// ParseLogLine parses a raw log line into a LogLine struct.
// Identical logic to Flask _parse_log_line (server.py lines 487-508).
func ParseLogLine(raw string) *LogLine {
	clean := stripANSI.ReplaceAllString(raw, "")
	clean = strings.TrimSpace(clean)
	if clean == "" {
		return nil
	}

	// Format 1: xray v5 structured
	if m := logV5.FindStringSubmatch(clean); m != nil {
		ts := m[1]
		short := ts
		if idx := strings.IndexByte(ts, 'T'); idx >= 0 && len(ts) >= idx+9 {
			short = ts[idx+1 : idx+9]
		}
		level := strings.ToLower(m[2])
		return &LogLine{Time: &short, Level: &level, Msg: m[3]}
	}

	// Format 2: mihomo/xray plain
	if m := logPlain.FindStringSubmatch(clean); m != nil {
		parts := strings.Fields(m[1])
		timePart := parts[len(parts)-1]
		if len(timePart) > 8 {
			timePart = timePart[:8]
		}
		level := strings.ToLower(m[2])
		return &LogLine{Time: &timePart, Level: &level, Msg: m[3]}
	}

	// Unstructured lines -- keep ANSI codes for frontend rendering (xkeen status)
	rawStripped := strings.TrimSpace(raw)
	if strings.Contains(rawStripped, "\x1b[") {
		return &LogLine{Time: nil, Level: nil, Msg: rawStripped}
	}
	return &LogLine{Time: nil, Level: nil, Msg: clean}
}

// resolveLogPath validates the log name against allowedLogs and returns the full path.
// Returns an error if the name is not in the allowed list.
func resolveLogPath(logDir, name string, allowedLogs map[string]string) (string, error) {
	filename, ok := allowedLogs[name]
	if !ok {
		return "", fmt.Errorf("unknown log: %s", name)
	}
	return filepath.Join(logDir, filename), nil
}

// ReadLogTail reads the last maxLines lines from a log file, parses them,
// and returns the parsed lines along with the file size (byte offset for incremental reading).
func ReadLogTail(logDir, name string, allowedLogs map[string]string, maxLines int) ([]LogLine, int64) {
	logPath, err := resolveLogPath(logDir, name, allowedLogs)
	if err != nil {
		return []LogLine{}, 0
	}

	f, err := os.Open(logPath)
	if err != nil {
		return []LogLine{}, 0
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return []LogLine{}, 0
	}
	size := info.Size()

	// Read all lines
	var allLines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024) // support long lines
	for scanner.Scan() {
		allLines = append(allLines, scanner.Text())
	}

	// Take last maxLines
	start := 0
	if len(allLines) > maxLines {
		start = len(allLines) - maxLines
	}
	tail := allLines[start:]

	// Parse
	var parsed []LogLine
	for _, line := range tail {
		if p := ParseLogLine(line); p != nil {
			parsed = append(parsed, *p)
		}
	}

	if parsed == nil {
		parsed = []LogLine{}
	}

	return parsed, size
}

// ReadFromOffset reads new lines from a byte offset. Returns parsed lines,
// new file size, and whether the file was truncated (size < offset).
func ReadFromOffset(logDir, name string, allowedLogs map[string]string, offset int64) ([]LogLine, int64, bool) {
	logPath, err := resolveLogPath(logDir, name, allowedLogs)
	if err != nil {
		return []LogLine{}, 0, false
	}

	f, err := os.Open(logPath)
	if err != nil {
		return []LogLine{}, 0, false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return []LogLine{}, 0, false
	}
	size := info.Size()

	// File was truncated
	if size < offset {
		return []LogLine{}, size, true
	}

	// No new content
	if size == offset {
		return []LogLine{}, size, false
	}

	// Read from offset
	if _, err := f.Seek(offset, 0); err != nil {
		return []LogLine{}, size, false
	}

	var lines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	var parsed []LogLine
	for _, line := range lines {
		if p := ParseLogLine(line); p != nil {
			parsed = append(parsed, *p)
		}
	}

	if parsed == nil {
		parsed = []LogLine{}
	}

	return parsed, size, false
}

// ClearLog truncates the specified log file.
func ClearLog(logDir, name string, allowedLogs map[string]string) error {
	logPath, err := resolveLogPath(logDir, name, allowedLogs)
	if err != nil {
		return err
	}

	// Check if file exists first
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return nil // Nothing to clear
	}

	return os.Truncate(logPath, 0)
}

// ReadLogRaw reads raw log content. If offset > 0, reads from that byte position.
// Otherwise reads the last maxLines lines as raw text.
// Returns content string, file size, and any error.
func ReadLogRaw(logDir, name string, allowedLogs map[string]string, maxLines int, offset int64) (string, int64, error) {
	logPath, err := resolveLogPath(logDir, name, allowedLogs)
	if err != nil {
		return "", 0, err
	}

	info, err := os.Stat(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", 0, nil
		}
		return "", 0, err
	}
	size := info.Size()

	f, err := os.Open(logPath)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()

	if offset > 0 {
		if offset >= size {
			// No new content since last poll
			return "", size, nil
		}
		if _, err := f.Seek(offset, 0); err != nil {
			return "", size, err
		}
		buf := make([]byte, size-offset)
		n, err := f.Read(buf)
		if err != nil {
			return "", size, err
		}
		return string(buf[:n]), size, nil
	}

	// Read last N lines (tail)
	var allLines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		allLines = append(allLines, scanner.Text())
	}

	start := 0
	if len(allLines) > maxLines {
		start = len(allLines) - maxLines
	}
	tail := allLines[start:]
	content := strings.Join(tail, "\n")
	if len(tail) > 0 {
		content += "\n"
	}

	return content, size, nil
}
