import { z } from "zod";

const factCategoryEnum = z.enum([
  "プロフィール",
  "好み",
  "家族",
  "仕事",
  "趣味",
  "その他",
]);

export const personaSchema = z.object({
  profile: z
    .object({
      name: z.string().optional().describe("ユーザーの名前"),
      preferredName: z
        .string()
        .optional()
        .describe(
          "ユーザーが希望する呼び方（例: 「たろうくん」「田中さん」）。指定があればnameより優先して使う",
        ),
      gender: z.string().optional().describe("性別"),
    })
    .optional()
    .describe("ユーザーの基本プロフィール"),

  personalFacts: z
    .array(
      z.object({
        fact: z
          .string()
          .describe(
            "事実の内容（例: 「60代くらい」「そばが好き」「村内に住んでいる」「移住を検討中」）",
          ),
        category: factCategoryEnum.describe("事実のカテゴリ"),
      }),
    )
    .optional()
    .describe(
      "ユーザーについての永続的な事実。年代、居住地、村との関わり（初めて/観光/移住検討など）、好きな食べ物、家族構成、職業、趣味など",
    ),
});

export type Persona = z.infer<typeof personaSchema>;

// ツール output 用のペルソナスキーマ（DB レコード形式）
export const personaOutputSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  content: z.string(),
  source: z.string().nullable(),
  topic: z.string().nullable(),
  sentiment: z.string().nullable(),
  demographicSummary: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  conversationEndedAt: z.string().nullable(),
});
