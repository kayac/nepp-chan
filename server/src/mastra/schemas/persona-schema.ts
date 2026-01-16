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
  // 長期記憶: ユーザーの基本プロフィール
  profile: z
    .object({
      name: z.string().optional().describe("ユーザーの名前や呼び名"),
      gender: z.string().optional().describe("性別"),
    })
    .optional()
    .describe("ユーザーの基本プロフィール"),

  // 長期記憶: ユーザーについての永続的な事実
  personalFacts: z
    .array(
      z.object({
        fact: z
          .string()
          .describe(
            "事実の内容（例: 「60代くらい」「そばが好き」「村内に住んでいる」）",
          ),
        category: factCategoryEnum.describe("事実のカテゴリ"),
      }),
    )
    .optional()
    .describe(
      "ユーザーについての永続的な事実。年代、居住地、趣味、家族構成、仕事など",
    ),
});

export type Persona = z.infer<typeof personaSchema>;
