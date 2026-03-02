export const stripMarkdown = (text: string): string =>
  text
    // コードブロック: ```lang\n...\n``` → 中身のみ
    .replace(/```[\s\S]*?\n([\s\S]*?)```/g, "$1")
    // インラインコード: `code` → code
    .replace(/`([^`]+)`/g, "$1")
    // リンク: [text](url) → text url
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2")
    // 太字+斜体: ***text*** → text
    .replace(/\*{3}(.+?)\*{3}/g, "$1")
    // 太字: **text** → text
    .replace(/\*{2}(.+?)\*{2}/g, "$1")
    // 斜体: *text* → text（行頭リスト記号は除外）
    .replace(/(?<!\n|A)\*(?!\s)(.+?)(?<!\s)\*/g, "$1")
    // 見出し: # text → text
    .replace(/^#{1,6}\s+/gm, "")
    // リスト記号: * や - → ・
    .replace(/^[\t ]*[*-]\s+/gm, "・")
    // 水平線: --- 等 → 空行
    .replace(/^[-*_]{3,}$/gm, "")
    // 連続空行を1つに
    .replace(/\n{3,}/g, "\n\n")
    .trim();
