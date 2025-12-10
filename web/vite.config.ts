import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, "../server/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/chat": "http://localhost:8787",
      "/health": "http://localhost:8787",
      "/weather": "http://localhost:8787",
    },
  },
});
