import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"
import { defineConfig } from "vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import reactScan from "@react-scan/vite-plugin-react-scan"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    reactScan({
      enable: true,
    }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
