import { z } from "zod";

export const personaSchema = z.object({
  // User Attributes
  age: z
    .enum([
      "不明",
      "10代",
      "20代",
      "30代",
      "40代",
      "50代",
      "60代",
      "70代",
      "80代以上",
    ])
    .describe("年代。初期値は「不明」。会話内容から類推できれば更新"),
  location: z
    .enum(["不明", "村内", "村外", "他地域"])
    .describe(
      "居住地／出身地。初期値は「不明」。生活感のある発言があれば「村内」と推定",
    ),
  relationship: z
    .enum(["不明", "観光客", "村人", "学生", "職員"])
    .describe(
      "ネップちゃんとの関係。初期値は「不明」。生活感のある発言があれば「村人」と推定",
    ),
  interestTheme: z
    .array(z.enum(["自然", "アート", "暮らし", "人間関係"]))
    .describe("関心テーマ（複数選択可）"),
  emotionalState: z
    .enum(["不明", "元気", "悩み中", "挑戦期"])
    .describe("感情傾向／状態。初期値は「不明」"),
  behaviorPattern: z
    .enum(["不明", "創作中心", "旅行中", "仕事中"])
    .describe("行動パターン。初期値は「不明」"),

  // Empathy Map
  says: z.string().describe("Says: ユーザーが実際に言ったこと"),
  thinks: z.string().describe("Thinks: ユーザーが考えていること（推測含む）"),
  does: z.string().describe("Does: ユーザーがとった行動"),
  feels: z.string().describe("Feels: ユーザーが感じていること"),

  // Important Information
  importantItems: z
    .array(z.string())
    .describe("ネップちゃんが重要と認識する項目（単語形式の配列）"),
});

export type Persona = z.infer<typeof personaSchema>;
