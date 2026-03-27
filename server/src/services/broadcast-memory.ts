import { broadcastRepository } from "~/repository/broadcast-repository";
import type { BroadcastPart } from "~/schemas/broadcast-schema";

const extractImageDescriptions = (partsJson: string | null): string[] => {
  if (!partsJson) return [];
  try {
    const parts = JSON.parse(partsJson) as BroadcastPart[];
    return parts
      .filter(
        (p): p is Extract<BroadcastPart, { type: "image" }> =>
          p.type === "image",
      )
      .map((p) => p.imageDescription)
      .filter((d): d is string => !!d);
  } catch {
    return [];
  }
};

export const buildBroadcastMemory = async (d1: D1Database): Promise<string> => {
  const { details, summaries } = await broadcastRepository.findRecentSent(d1, {
    detailLimit: 3,
    summaryDays: 30,
  });

  if (details.length === 0 && summaries.length === 0) {
    return "";
  }

  const lines: string[] = [
    "## ねっぷちゃんのお知らせ記憶（LINE配信メッセージ）",
    "以下はあなた（ねっぷちゃん）がLINEで全フォロワーに送った配信メッセージ。",
    "「これ」「さっきの」と言われたら直近の配信を参照する。",
    "古い配信の詳細は broadcast-get ツールで取得する。",
    "",
  ];

  if (details.length > 0) {
    lines.push("### 最近の配信（詳細）");
    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      const date = d.sentAt ? d.sentAt.slice(0, 10) : d.createdAt.slice(0, 10);
      lines.push(`${i + 1}. [${date}] ${d.title}`);
      lines.push(`   内容: ${d.body}`);
      for (const desc of extractImageDescriptions(d.parts)) {
        lines.push(`   添付画像の内容: ${desc}`);
      }
    }
    lines.push("");
  }

  if (summaries.length > 0) {
    lines.push("### 過去の配信一覧");
    for (const s of summaries) {
      const date = s.sentAt ? s.sentAt.slice(0, 10) : "";
      lines.push(`- [${date}] ${s.title} (id: ${s.id})`);
    }
    lines.push("");
  }

  return lines.join("\n");
};
