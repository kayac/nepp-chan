import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// スキルのメタデータ定義
interface SkillMetadata {
    name: string;
    description: string;
    path: string;
    tags?: string[];
}

// スキル一覧（実際はファイルシステムやDBから動的に読み込んでもOK）
const SKILLS: Record<string, SkillMetadata> = {
    counseling: {
        name: "counseling",
        description: "ユーザーの悩みを聞き、共感して励ますためのガイドライン",
        path: "src/skills/counseling/SKILL.md",
        tags: ["communication", "mental-health"],
    },
    "village-guide": {
        name: "village-guide",
        description: "音威子府村の観光名所や名物を案内するためのガイドライン",
        path: "src/skills/village-guide/SKILL.md",
        tags: ["guide", "otoineppu", "sightseeing"],
    },
    "office-support": {
        name: "office-support",
        description: "役場の手続きや生活情報（ゴミ出し等）を案内するためのガイドライン",
        path: "src/skills/office-support/SKILL.md",
        tags: ["guide", "otoineppu", "life"],
    },
};

/**
 * スキル一覧を取得するツール
 * - 軽量なメタデータのみ返す（Progressive Disclosure）
 * - エージェントはまずこのツールで利用可能なスキルを確認する
 */
export const listSkillsTool = createTool({
    id: "list-skills",
    description: `
利用可能なスキル（専門知識・ベストプラクティス）の一覧を取得する。
各スキルの名前と概要のみを返す。

【使用タイミング】
- タスクに取り組む前に、関連するスキルがあるか確認したい時
- どのようなスキルが利用可能か把握したい時

【次のステップ】
関連するスキルが見つかったら read-skill で詳細を読み込む。
  `.trim(),
    inputSchema: z.object({
        tag: z
            .string()
            .optional()
            .describe("フィルタするタグ（例: document, ui）"),
    }),
    outputSchema: z.object({
        skills: z.array(
            z.object({
                name: z.string(),
                description: z.string(),
                tags: z.array(z.string()).optional(),
            })
        ),
    }),
    execute: async ({ tag }) => {
        let skills = Object.values(SKILLS);

        // タグでフィルタリング
        if (tag) {
            skills = skills.filter((s) => s.tags?.includes(tag));
        }

        return {
            skills: skills.map((s) => ({
                name: s.name,
                description: s.description,
                tags: s.tags,
            })),
        };
    },
});

/**
 * スキルの詳細内容を読み込むツール
 * - SKILL.md の全文を返す
 * - 必要な時だけ呼び出す（トークン節約）
 */
export const readSkillTool = createTool({
    id: "read-skill",
    description: `
指定したスキルの詳細な内容（SKILL.md）を読み込む。

【使用タイミング】
- list-skills で関連するスキルを見つけた後
- タスク実行前にベストプラクティスを確認したい時

【重要】
- 必ず list-skills で一覧を確認してから使用すること
- 読み込んだスキルの指示に従ってタスクを実行すること
  `.trim(),
    inputSchema: z.object({
        skillName: z.string().describe("読み込むスキル名（list-skills で確認した name）"),
    }),
    outputSchema: z.object({
        skillName: z.string(),
        content: z.string(),
    }),
    execute: async ({ skillName }) => {
        const skill = SKILLS[skillName];

        if (!skill) {
            const available = Object.keys(SKILLS).join(", ");
            throw new Error(
                `スキル "${skillName}" が見つかりません。利用可能: ${available}`
            );
        }

        // ファイルから詳細を読み込む
        const fullPath = path.resolve(process.cwd(), skill.path);
        const content = await fs.readFile(fullPath, "utf-8");

        return {
            skillName: skill.name,
            content,
        };
    },
});
