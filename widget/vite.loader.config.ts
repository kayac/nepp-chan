import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../lp/public/widget",
    emptyOutDir: false,
    lib: {
      entry: "src/loader-entry.ts",
      formats: ["iife"],
      name: "NeppChatWidget",
      fileName: () => "widget.js",
    },
  },
});
