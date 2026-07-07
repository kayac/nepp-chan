---
name: quality-check
description: "コード変更の品質ゲート。lint・テスト・ビルド検証 → コード品質レビューを実行する。"
---

# Quality Check

コード変更を伴うタスクの完了時に実行する品質ゲート。
ドキュメント微修正・設定ファイルのみの変更では使わない。

## 手順

### 1. テスト・ビルド検証

```bash
pnpm lint
pnpm web:build
```

変更したモジュールに対応するテストを実行する:
- server: `pnpm --filter @nepp-chan/server test --run`
- web: `pnpm --filter @nepp-chan/web test --run`
- shared: `pnpm --filter @nepp-chan/shared test --run`

失敗があれば修正してから次へ進む。

### 2. コメント自己チェック

変更ファイルの diff を確認し、追加・変更したコメントを CLAUDE.md「コーディング規約 > コメント」に照らして精査する。

- 残すのは「コードを読んだだけでは誤解する非自明な事実」だけ。迷ったら消す
- 変更経緯・タスク参照・WHAT の説明・自明な JSDoc・セクション区切りは削除する

### 3. /simplify

変更コードの再利用性・品質・効率を見直す。修正があればステップ 1 を再実行。

### 4. コードレビュー

`code-reviewer` エージェントで変更コードをレビューする。CLAUDE.md のコーディング規約への準拠も確認される。
指摘があれば修正してステップ 1 を再実行。

codex プラグインが利用可能な場合は追加で実行する:
- `/codex:review`
- `/codex:adversarial-review`（`~/.claude/codex-review-ruleset.md` を focus で渡す）

codex の指摘は `~/.claude/codex-review-ruleset.md` の基準で取捨選択する。取り込まない判断には理由を添え、結果をユーザーに伝える。
