import { defineConfig } from "drizzle-kit";

const D1_DATABASE_IDS = {
  dev: "bd4f1aee-768d-4273-ab72-5aef42f1c199",
  prd: "239abba6-e30a-4628-97fc-20bf49ca8404",
} as const;

const d1Env = process.env.D1_ENV as keyof typeof D1_DATABASE_IDS | undefined;
const databaseId = d1Env ? D1_DATABASE_IDS[d1Env] : undefined;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  tablesFilter: ["!mastra_*"],
  ...(databaseId && {
    driver: "d1-http",
    dbCredentials: {
      accountId: "51544998e04526c4d6cc9e3e08653361",
      databaseId,
      token: process.env.CLOUDFLARE_API_TOKEN!,
    },
  }),
});
