import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"
import { defineConfig } from "vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import reactScan from "@react-scan/vite-plugin-react-scan"

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    reactScan({
      enable: command === "serve",
    }),
    tailwindcss(),
    {
      name: "serve-config",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/config.js") {
            res.setHeader("Content-Type", "application/javascript")
            res.end(`window.SUBSTORE_CONFIG = { EXECUTION_URL: "" };`)
            return
          }
          next()
        })
      },
    },
  ],
  server: {
    proxy: {
      "/api": {
        target: process.env.SUBSTORE_DEV_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
