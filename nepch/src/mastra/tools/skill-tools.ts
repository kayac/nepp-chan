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
    docx: {
        name: "docx",
        description: "Word文書（.docx）の作成・編集に関するベストプラクティス",
        path: "src/skills/docx/SKILL.md",
        tags: ["document", "office"],
    },
    pdf: {
        name: "pdf",
        description: "PDF操作・フォーム入力・テキスト抽出のガイドライン",
        path: "src/skills/pdf/SKILL.md",
        tags: ["document", "form"],
    },
    "frontend-design": {
        name: "frontend-design",
        description: "高品質なUIデザインとReactコンポーネント作成のベストプラクティス",
        path: "src/skills/frontend-design/SKILL.md",
        tags: ["ui", "react", "design"],
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
    execute: async ({ context }) => {
        let skills = Object.values(SKILLS);

        // タグでフィルタリング
        if (context.tag) {
            skills = skills.filter((s) => s.tags?.includes(context.tag!));
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
    execute: async ({ context }) => {
        const skill = SKILLS[context.skillName];

        if (!skill) {
            const available = Object.keys(SKILLS).join(", ");
            throw new Error(
                `スキル "${context.skillName}" が見つかりません。利用可能: ${available}`
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
