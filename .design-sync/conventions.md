# ねっぷちゃん DS — 使い方の規約

音威子府村の AI キャラクター「ねっぷちゃん」の UI。世界観は「紙の温度・雪と森の村・手ざわりのある温かさ」。利用者は高齢の村民を含むスマホ主体のユーザー。

## セットアップ

- ThemeProvider は不要。トークンは `styles.css` が定義する CSS カスタムプロパティで供給される
- **チャット系コンポーネント（`Thread` / `Composer` / `AssistantMessage` / `ChatStandingMascot` / `FeedbackModal`）は必ず `ChatPreviewProvider` で包む**。包み忘れると "useChatContext must be used within ChatProvider" で落ちる。`ChatPreviewProvider` はモック会話を供給する（本物のデータ配線は不要）
- `Thread` は `flex-1` 前提。高さ付きコンテナ（`display:flex; flexDirection:column; height:○px`）に入れる
- `Dialog` / `FeedbackModal` は native `<dialog>` の `showModal()` でマウント時に開く

## スタイリングの流儀

- **自分で書くレイアウト glue は inline style + `var(--トークン)` で書く**。新しい Tailwind クラスは書かない（この環境にはランタイム Tailwind がなく、コンポーネント内部で使用済みのクラスしか CSS に存在しない）
- 生の hex・任意の色は書かない。必ずトークンを使う:
  - 面: `--bg-app`(アプリ地) `--bg-raised`(カード) `--bg-sunken`(くぼみ) `--panel` `--bg-overlay`
  - 文字: `--fg-1`(主) `--fg-2` `--fg-3` `--fg-4`(補助) `--fg-on-brand`
  - ブランド: `--brand` `--brand-hover` `--brand-press` `--brand-soft` `--ring-brand`
  - 意味色: `--success(-bg)` `--warning(-bg)` `--danger(-bg)` `--info` / 管理画面系は `--admin(-bg/-border/-hover/-light)`
  - 枠・角丸・影: `--border-1/2`、`--r-xs〜--r-2xl` `--r-pill` `--r-bubble` `--r-card-lg` `--r-organic`、`--shadow-xs〜lg` `--shadow-float-sm/md/lg` `--shadow-brand`
  - 文字組み: `--font-display`(見出し・丸ゴ) `--font-body` `--font-mono`、`--fs-xs〜--fs-4xl`、`--fw-regular/medium/bold/black`、`--lh-tight/snug/normal/relaxed`
  - パレット直参照が要る装飾のみ: `--teal-50〜900` `--paper-0〜200` `--snow-0〜900` `--apricot-*` `--moss-*` `--sky-*` `--berry` `--honey` `--pine`
- **色はセマンティックに**: teal=ブランド・主要アクション / apricot=管理者コンテキスト / moss=成功 / sky=情報 / berry・honey・pine=キャラ装飾のみ
- 本文は `--fs-base`(15px) 未満にしない。行間は `--lh-normal`(1.7) 基準
- マスコットは装飾でなく状態表現。`<Mascot state="…">`（idle/thinking/talking/success/alert/surprise/error/quiet/sleep/greet/cheer/guide/stretch）で意味を持たせる。画像は同梱 CSS シムで自動表示される
- ねっぷちゃんの声として読まれる文はキャラ口調（「〜だよ」+絵文字）、システム文言は簡潔な丁寧語

## 真実の在り処

- トークンの実値と全定義: `styles.css`（`_ds_bundle.css` を @import。冒頭に Google Fonts の Zen Maru Gothic / M PLUS Rounded 1c / Noto Sans JP）
- 各コンポーネントの API: `components/<group>/<Name>/<Name>.d.ts`、使用例: 同 `<Name>.prompt.md`

## 典型的な組み方

```tsx
import { ChatPreviewProvider, Thread, SpeechBubble, ChatMarkdown, Button, Mascot } from "@nepp-chan/shared";

// チャット画面まるごと
<ChatPreviewProvider>
  <div style={{ display: "flex", flexDirection: "column", height: 560, background: "var(--bg-app)" }}>
    <Thread />
  </div>
</ChatPreviewProvider>

// 吹き出し単体 + 自作 glue
<div style={{ maxWidth: 480, padding: 16, background: "var(--bg-app)", borderRadius: "var(--r-lg)" }}>
  <SpeechBubble variant="assistant">
    <ChatMarkdown variant="assistant" text={"音威子府村へようこそ！✨"} />
  </SpeechBubble>
  <Button style={{ marginTop: 12 }}>話しかける</Button>
</div>
```
