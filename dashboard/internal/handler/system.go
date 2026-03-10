package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// cpuState stores the previous CPU reading for delta calculation.
// Identical to Flask _prev_cpu pattern.
type cpuState struct {
	mu        sync.Mutex
	prevIdle  int64
	prevTotal int64
}

// Global CPU state -- one per process, same as Flask module-level _prev_cpu.
var cpuPrev = &cpuState{}

// SystemCPU returns current CPU usage percentage from /proc/stat.
// Uses delta calculation against previous reading.
// Response: 200 {"cpu": 45.2} | 200 {"cpu": 0, "error": "..."}
func (h *Handlers) SystemCPU(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"cpu":   0,
			"error": err.Error(),
		})
		return
	}

	// Parse first line: "cpu  user nice system idle iowait irq softirq steal ..."
	lines := strings.SplitN(string(data), "\n", 2)
	if len(lines) == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"cpu":   0,
			"error": "empty /proc/stat",
		})
		return
	}

	parts := strings.Fields(lines[0])
	if len(parts) < 5 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"cpu":   0,
			"error": "unexpected /proc/stat format",
		})
		return
	}

	// Parse all numeric values (skip "cpu" label)
	var values []int64
	for _, p := range parts[1:] {
		v, err := strconv.ParseInt(p, 10, 64)
		if err != nil {
			continue
		}
		values = append(values, v)
	}

	if len(values) < 4 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"cpu":   0,
			"error": "not enough values in /proc/stat",
		})
		return
	}

	idle := values[3] // idle is the 4th field
	var total int64
	for _, v := range values {
		total += v
	}

	cpuPrev.mu.Lock()
	prevIdle := cpuPrev.prevIdle
	prevTotal := cpuPrev.prevTotal
	cpuPrev.prevIdle = idle
	cpuPrev.prevTotal = total
	cpuPrev.mu.Unlock()

	// First reading (prev total == 0): return 0
	if prevTotal == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{"cpu": 0})
		return
	}

	dTotal := total - prevTotal
	dIdle := idle - prevIdle

	if dTotal == 0 {
		writeJSON(w, http.StatusOK, map[string]interface{}{"cpu": 0})
		return
	}

	// Calculate usage, round to 1 decimal place
	usage := (1.0 - float64(dIdle)/float64(dTotal)) * 100.0
	usage = math.Round(usage*10) / 10

	writeJSON(w, http.StatusOK, map[string]interface{}{"cpu": usage})
}

// SystemMemory returns system memory stats from /proc/meminfo.
// Response: 200 {"total": bytes, "available": bytes, "used": bytes}
func (h *Handlers) SystemMemory(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"total":     0,
			"available": 0,
			"used":      0,
			"error":     err.Error(),
		})
		return
	}

	// Parse key-value lines: "MemTotal:       1024000 kB"
	values := make(map[string]int64)
	for _, line := range strings.Split(string(data), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		valStr := strings.TrimSpace(parts[1])
		valStr = strings.TrimSuffix(valStr, " kB")
		valStr = strings.TrimSpace(valStr)
		v, err := strconv.ParseInt(valStr, 10, 64)
		if err != nil {
			continue
		}
		values[key] = v * 1024 // convert kB to bytes
	}

	total := values["MemTotal"]
	available := values["MemAvailable"]
	used := total - available

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total":     total,
		"available": available,
		"used":      used,
	})
}

// ipPattern validates IP addresses (IPv4 or IPv6).
var ipPattern = regexp.MustCompile(`^[\d.]+$|^[0-9a-fA-F:]+$`)

// ipServices is the ordered list of external IP lookup services.
var ipServices = []string{
	"ifconfig.me",
	"icanhazip.com",
	"api.ipify.org",
	"ip.sb",
}

// SystemNetwork returns external IP, geo info, and system uptime.
// Response: 200 {"ip": "1.2.3.4", "info": {...}, "uptime": 123456}
// Null values: ip can be null, info can be null, uptime can be null.
func (h *Handlers) SystemNetwork(w http.ResponseWriter, r *http.Request) {
	result := map[string]interface{}{
		"ip":   nil,
		"info": nil,
	}

	// Try to get external IP via curl with fallback chain
	// 5-second total timeout for all IP lookup attempts
	totalCtx, totalCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer totalCancel()

	for _, service := range ipServices {
		select {
		case <-totalCtx.Done():
			goto ipDone
		default:
		}

		func(svc string) {
			ctx, cancel := context.WithTimeout(totalCtx, 3*time.Second)
			defer cancel()

			out, err := exec.CommandContext(ctx, "curl", "-sf", "-m", "3",
				fmt.Sprintf("https://%s", svc)).Output()
			if err != nil {
				return
			}
			ipText := strings.TrimSpace(string(out))
			if ipText != "" && ipPattern.MatchString(ipText) {
				result["ip"] = ipText
			}
		}(service)

		if result["ip"] != nil {
			break
		}
	}

ipDone:
	// Try to get IP info (country, ISP) via ip-api.com
	if ip, ok := result["ip"].(string); ok && ip != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		out, err := exec.CommandContext(ctx, "curl", "-s", "-m", "3",
			fmt.Sprintf("http://ip-api.com/json/%s?fields=country,city,isp,query", ip)).Output()
		if err == nil {
			trimmed := strings.TrimSpace(string(out))
			if trimmed != "" {
				var info interface{}
				if err := json.Unmarshal([]byte(trimmed), &info); err == nil {
					result["info"] = info
				}
			}
		}
	}

	// Get uptime from /proc/uptime
	result["uptime"] = nil
	uptimeData, err := os.ReadFile("/proc/uptime")
	if err == nil {
		fields := strings.Fields(string(uptimeData))
		if len(fields) > 0 {
			if secs, err := strconv.ParseFloat(fields[0], 64); err == nil {
				result["uptime"] = int(secs)
			}
		}
	}

	writeJSON(w, http.StatusOK, result)
}
