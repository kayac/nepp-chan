-- 埋め込みウィジェットの設置サイト allowlist
CREATE TABLE IF NOT EXISTS widget_sites (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

INSERT OR IGNORE INTO widget_sites (id, host, instructions, created_at) VALUES (
  '018f2c1a-0000-7000-8000-000000000001',
  'vill.otoineppu.hokkaido.jp',
  'ユーザーは音威子府村の公式ホームページ（https://www.vill.otoineppu.hokkaido.jp）を見ながら話しかけている。
- 行政手続き・窓口案内の質問を優先して受け止める（担当窓口・受付時間・必要な持ち物など）
- 答えるときは該当する公式ホームページのページ URL を添える',
  '2026-08-12T00:00:00.000Z'
);
