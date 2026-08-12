import { z } from "@hono/zod-openapi";

export const widgetSiteSchema = z.object({
  id: z.string(),
  host: z.string(),
  instructions: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const widgetSiteInputSchema = z.object({
  host: z
    .string()
    .min(1)
    .max(255)
    .describe("設置サイトのホスト名（例: www.vill.otoineppu.hokkaido.jp）"),
  instructions: z
    .string()
    .min(1)
    .max(4000)
    .describe("このサイトで開かれたときにねっぷちゃんへ渡す指示"),
});
