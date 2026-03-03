package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

// AppConfig holds all application configuration loaded from environment variables.
type AppConfig struct {
	MihomoConfigPath string
	XkeenDir         string
	BackupDir        string
	XkeenBin         string
	XkeenLogDir      string
	Port             int
	DevMode          bool
	Version          string

	// AllowedLogs maps log name to filename (identical to Flask).
	AllowedLogs map[string]string

	// XkeenFiles maps route name to actual filename (identical to Flask).
	XkeenFiles map[string]string
}

// LoadConfig reads configuration from environment variables with defaults
// identical to the Flask backend (backend/server.py).
func LoadConfig() *AppConfig {
	return &AppConfig{
		MihomoConfigPath: getEnv("MIHOMO_CONFIG_PATH", "/opt/etc/mihomo/config.yaml"),
		XkeenDir:         getEnv("XKEEN_DIR", "/opt/etc/xkeen"),
		BackupDir:        getEnv("BACKUP_DIR", "/opt/etc/mihomo/backups"),
		XkeenBin:         getEnv("XKEEN_BIN", "/opt/sbin/xkeen"),
		XkeenLogDir:      getEnv("XKEEN_LOG_DIR", "/opt/var/log/xray"),
		Port:             getEnvInt("PORT", 5000),
		DevMode:          getEnv("DEV_MODE", "") != "",
		Version:          getEnv("VERSION", "0.1.0"),
		AllowedLogs: map[string]string{
			"error":  "error.log",
			"access": "access.log",
		},
		XkeenFiles: map[string]string{
			"ip_exclude":    "ip_exclude.lst",
			"port_exclude":  "port_exclude.lst",
			"port_proxying": "port_proxying.lst",
		},
	}
}

// GetMihomoSecret reads the mihomo config.yaml and extracts the "secret" field value.
// Returns empty string if the file doesn't exist or the field is not found.
func GetMihomoSecret(configPath string) string {
	return ReadMihomoField(configPath, "secret")
}

// GetMihomoExternalController reads the "external-controller" field from mihomo config.yaml.
// Returns "127.0.0.1:9090" as default if not found.
func GetMihomoExternalController(configPath string) string {
	val := ReadMihomoField(configPath, "external-controller")
	if val == "" {
		return "127.0.0.1:9090"
	}
	return val
}

// ReadMihomoField performs a simple line-by-line scan for a top-level YAML key.
// This avoids importing a full YAML parser just for reading one field.
// Exported for use by the updater package (external-ui detection).
func ReadMihomoField(configPath, key string) string {
	f, err := os.Open(configPath)
	if err != nil {
		return ""
	}
	defer f.Close()

	prefix := key + ":"
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, prefix) {
			val := strings.TrimPrefix(trimmed, prefix)
			val = strings.TrimSpace(val)
			// Handle quoted values: find matching closing quote, ignore trailing comment
			if len(val) >= 2 && (val[0] == '\'' || val[0] == '"') {
				quote := val[0]
				if end := strings.IndexByte(val[1:], quote); end >= 0 {
					return val[1 : end+1]
				}
			}
			// Unquoted: strip inline YAML comments (# ...)
			if idx := strings.Index(val, " #"); idx >= 0 {
				val = strings.TrimSpace(val[:idx])
			}
			return val
		}
	}
	return ""
}

// getEnv returns the value of an environment variable or fallback if not set/empty.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getEnvInt returns the integer value of an environment variable or fallback.
func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
