import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // =============================================================
      // Dev proxy configuration -- two modes:
      //
      // Mode 1 (current): Flask + mihomo on separate ports
      //   - Flask backend on :5000 handles config API
      //   - Mihomo on :9090 handles proxy/connection/rule API
      //
      // Mode 2: Go backend on :5000 (serves everything)
      //   - Uncomment "Go backend mode" section below
      //   - Comment out all per-route proxy entries above it
      // =============================================================

      // --- Flask + mihomo mode (current) ---
      // Flask Config API (service management, config, xkeen files, versions, health)
      '/api/service': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      '/api/versions': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      '/api/config': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      '/api/xkeen': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      '/api/health': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      '/api/system': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      '/api/logs': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
      },
      // WebSocket terminal SSH bridge
      '/ws/terminal': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
        ws: true,
      },
      // WebSocket log streaming
      '/ws': {
        target: 'http://172.16.10.1:5000',
        changeOrigin: true,
        ws: true,
      },
      // Mihomo REST API (all other /api/* goes to mihomo)
      '/api': {
        target: 'http://172.16.10.1:9090',
        changeOrigin: true,
        headers: {
          'Authorization': 'Bearer admin',
        },
      },

      // --- Go backend mode (uncomment when using Go backend) ---
      // All requests go to Go backend on :5000 which serves
      // config API, mihomo proxy (/api/mihomo/*), WS, and SPA.
      // '/api': { target: 'http://172.16.10.1:5000', changeOrigin: true },
      // '/ws': { target: 'http://172.16.10.1:5000', changeOrigin: true, ws: true },
    },
  }
})
