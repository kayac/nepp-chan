import react from "@astrojs/react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  server: { port: 5173 },
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      ...(process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT_WEB,
              authToken: process.env.SENTRY_AUTH_TOKEN,
              sourcemaps: {
                filesToDeleteAfterUpload: ["./dist/**/*.map"],
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "~": "/src",
      },
    },
    optimizeDeps: {
      exclude: ["msw", "msw/node"],
    },
    build: {
      sourcemap: "hidden",
    },
  },
});
