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
      // Mihomo REST API (all other /api/* goes to mihomo)
      '/api': {
        target: 'http://172.16.10.1:9090',
        changeOrigin: true,
        headers: {
          'Authorization': 'Bearer admin',
        },
      },
    },
  }
})
