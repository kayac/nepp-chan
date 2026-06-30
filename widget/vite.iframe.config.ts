import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/widget/",
  plugins: [react(), tailwindcss()],
  server: { port: 5175 },
  build: {
    outDir: "../lp/public/widget",
    emptyOutDir: true,
  },
});
