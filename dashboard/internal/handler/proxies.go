package handler

import (
	"fmt"
	"net/http"
	"os"

	"github.com/goccy/go-yaml"
)

// ProxyServers extracts proxy name -> server:port from mihomo config.
// Response: 200 {"NodeName": "server.com:443", ...} | 500 {"error": "..."}
func (h *Handlers) ProxyServers(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(h.cfg.MihomoConfigPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	var config map[string]interface{}
	if err := yaml.Unmarshal(data, &config); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
		return
	}

	result := map[string]string{}

	proxies, ok := config["proxies"]
	if !ok {
		writeJSON(w, http.StatusOK, result)
		return
	}

	proxyList, ok := proxies.([]interface{})
	if !ok {
		writeJSON(w, http.StatusOK, result)
		return
	}

	for _, p := range proxyList {
		pm, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := pm["name"].(string)
		server, _ := pm["server"].(string)
		if name == "" || server == "" {
			continue
		}
		port := pm["port"]
		if port != nil {
			result[name] = fmt.Sprintf("%s:%v", server, port)
		} else {
			result[name] = server
		}
	}

	writeJSON(w, http.StatusOK, result)
}
