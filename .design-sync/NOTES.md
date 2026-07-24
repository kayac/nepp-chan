# design-sync NOTES

## リポジトリ固有の構成

- shared にはビルド（dist）がなく synth-entry モード。converter は `<node_modules>/@nepp-chan/shared` の存在を前提にするため、`--entry ./shared/src/__synth__.mjs`（非実在パス）を渡して PKG_DIR を実ディレクトリ `shared/` に解決させる。`--node-modules shared/node_modules`
- web コンポーネントは `.design-sync/ds-entry-web.tsx`（extraEntries）+ `componentSrcMap` の `../web/src/...` 相対パスで取り込む
- Props 型はプロジェクト規約で全て非公開の `Props`（`<Name>Props` ではない）ため自動抽出が効かず、`dtsPropsFor` に全件手書き。**コンポーネントの props を変えたら config の dtsPropsFor も更新すること**
- CSS は Tailwind v4。`.design-sync/tw-entry.css` を `@tailwindcss/cli`（.ds-sync に npm install、`.design-sync/node_modules` は `../.ds-sync/node_modules` への symlink）でコンパイルし、出力は cssEntry のパッケージ境界制約のため `shared/node_modules/.ds-cache/tw-compiled.css` に置く（buildCmd が生成）
- プレビューの layout glue は**インラインスタイル + var(--token) を使う**。Tailwind クラスはコンパイル時点の @source スキャンに依存するため、プレビューで新しいクラスを使う場合は tailwind 再コンパイル → package-build 再実行が必要
- フォントは Google Fonts のリモート @import（[FONT_REMOTE]、対応不要）

## マスコット画像シム

- Mascot/TopBar は `/mascot/*.png` `/logo-neppu.png` をルート絶対パスで参照し、Claude Design 上では 404 になる
- `.design-sync/generate-asset-css.mjs`（要 `brew install webp`）が 320px webp の data URI で `img[src="…"] { content: url(…) }` シムを生成 → tw-entry.css が @import。buildCmd に組み込み済み
- **web/public/mascot/ に画像を追加したら buildCmd 再実行で自動追従**（Mascot.tsx の MASCOT_ASSETS も参照）

## 既知の警告（正当としてトリアージ済み）

- `[EXPORT_COLLISION] ds-entry-web.tsx exports N name(s)...` — synth モードが componentSrcMap の全名を main package の export 集合に加算することによる誤検知。main entry（shared の src ファイル群）は web の名前を実際には export しておらず、render check で全カードの描画を確認済み。N はコンポーネント追加・移動のたびに変動する（無害）
- `[NO_DIST] --entry ... doesn't exist` — 意図的（PKG_DIR 解決トリック）

## 検証環境

- playwright は **1.60.0** を使う（キャッシュ済み chromium-1223 に一致。latest は 1228 を要求して落ちる）
- `.ds-sync/` に esbuild / ts-morph / @types/react / playwright@1.60.0 / tailwindcss / @tailwindcss/cli を npm install

## プレビュー作成の知見（wave A で確立したパターン）

- **config の overrides を変えたら必ず package-build を再実行**してから preview-rebuild する。`.stories-map.json` の cfgSlice スタンプが不一致だと `[CONFIG_STALE]` で止まる（viewport はキー対象、cardMode は除外）
- **fixed 系コンポーネント**（ThreadSidebar / ChatStandingMascot 等）は cardMode single にしなくても、プレビュー側の `{ position: "relative", height: <px>, transform: "translateZ(0)", overflow: "hidden" }` ラッパーで card 内に収まる（translateZ が containing block になる）
- `--thread-max-width` 依存はコンテナに `["--thread-max-width" as string]: "42rem"` をインライン指定
- tool part / updatedAt など dtsPropsFor の簡略型にないフィールドは `as never` キャストで渡す
- recharts は **bar が確実**（アニメ 400ms で完了）。line は 1500ms アニメの途中でキャプチャされ折れ線が切れる
- Landing は実高 ~880px。プレビューは `height: 880, zoom: 0.72` で全景を収めている
- capture viewport は 900px 幅 = lg(1024) 未満なので、md/モバイル配置で写るコンポーネントがある（ChatStandingMascot は右下 112px）
- AssistantMessage.tsx のプレビューには icon.png のローカル `<style>` シムが埋め込まれている（グローバルシムに icon.png を追加済みなので冗長だが無害）

## Re-sync リスク（次回の同期で注視すること）

- **dtsPropsFor は全件手書き**のため、コンポーネントの props 変更に自動追従しない。API を変えたら config の該当エントリも更新（特に enum バリアントの増減）
- ds-entry-web.tsx の再エクスポート一覧・mockMessages は web 側のリファクタ（ファイル移動・ChatContext の形変更）で壊れる。ビルドエラーまたは provider エラーとして顕在化する
- アセットシムは web/public の画像パス（/mascot/*、/logo-neppu.png、/bg-winter.png のインラインスタイル）に依存。パスが変わったら generate-asset-css.mjs を追従
- Tailwind クラスはコンパイル時スキャン。プレビューが新しいクラスを使う場合は buildCmd（tailwind 再コンパイル）→ package-build の順で反映
- playwright のキャッシュ chromium が更新されたら .ds-sync の playwright バージョンも合わせ直す（NOTES 検証環境の項参照）
- capture 検証は viewport 900px（md 相当）。lg 専用レイアウトは未検証
- recharts の line チャートはアニメーション途中でキャプチャされる既知事象（プレビューは bar を使用）
- **package shape の sourceKey は実コンポーネント実装ファイル（Button.tsx 等）をハッシュしない**（`.design-sync/previews/<Name>.tsx` の owned preview ファイル + config スライスのみ）。実装だけ変えて owned preview を変えていないと re-sync の diff は "unchanged/verified-by-upload" と判定し capture/grade をスキップする。ただし `_ds_bundle.js` 自体は atomic path の "writes — everything, always" で常に再アップロードされるため、**実際に配信されるバンドルは正しく更新される**（アップロード自体は漏れない）。ただし自動グレーディングは効かないので、実装だけの色/スタイル修正をした後は package-validate.mjs の `_screenshots/` を目視確認してから upload すること（2026-07-23 の色トークン修正で確認済みの挙動）

## 役割別グルーピング(2026-07-23)

`general`(旧: Button/Spinner/LoadingDots/LoadingText/ToolLoadingState/ToolEmptyState/Mascot/AmbientBG/ChatMarkdown の9件)を役割別に再分類した:

- `primitives`: Button / Spinner / LoadingDots / LoadingText — 汎用UIプリミティブ
- `mascot`: Mascot / AmbientBG — ブランド演出
- `tool-ui`: ToolLoadingState / ToolEmptyState — ツール呼び出しの状態表示
- `minichat`: ChatMarkdown — lp の MiniChat(埋め込みウィジェット)専用の吹き出しレンダラー。web の Thread では使われていない(web 側は MarkdownText を使用)

## 新規コンポーネント追加(2026-07-23: ModalHeader / RatingBadge)

web 側のコンポーネント共通化作業で新設した `web/src/components/ui/ModalHeader.tsx` と `RatingBadge.tsx` を design-sync に追加登録した。両方とも `../web/src/components/ui/` 配下のため、既存の `Dialog` と同じ理由で自動的に `web` グループへ入る(componentSrcMap のパス由来グルーピング、既知の制約は上記「役割別グルーピング」参照)。

- `ds-entry-web.tsx` に re-export を追加
- `config.json` の `componentSrcMap`/`dtsPropsFor` に追加(Props 型は非公開の `Props` のため手書き)
- `ModalHeader` は幅420pxのカードで `[GRID_OVERFLOW]` が出たため `overrides.ModalHeader.cardMode: "column"` を追加
- `.design-sync/previews/ModalHeader.tsx`(TitleOnly / WithDescription)・`RatingBadge.tsx`(Variants: good/idea/bad)を新規authoring、グレード済み(good)

## previews のパッケージ依存は shared 側にも必要

`.design-sync/previews/*.tsx`(Button.tsx・ToolLoadingState.tsx 等)が参照するアイコン等のパッケージは、`--node-modules shared/node_modules` で解決されるため、実際に使ってるアプリ(web等)の package.json だけでなく `shared/package.json` にも依存として入れておく必要がある。現状 `@heroicons/react` が該当(shared の実コードでは未使用、previews authoring 専用)。

**同様の理由で追加していないもの**: `ErrorBanner`/`EmptyStateCard`/`PanelLoading` はダッシュボード(管理画面)向けの状態表示コンポーネントで、現行DSが対象にしてる市民向けチャット/投票/ミニチャット面とは領域が異なるため見送った。将来ダッシュボード面もDS対象にする場合はこの3つが追加候補になる。

再分類は `docsMap`(`.design-sync/groups/<Name>.md` の `category:` frontmatter)で実施。**パスは `PKG_DIR`(shared/)基準で解決される**ため `../.design-sync/groups/<Name>.md` と書く(`.design-sync/groups/...` だと `shared/.design-sync/...` を探しに行き見つからない)。

**制約(重要)**: `docsMap` の `category` は **`c.group` が `general`/`misc`/未設定のときにしか効かない**(package-build.mjs 側の条件)。`chat`(14件)/`web`(Dialog)/`poll`(ChoiceBar)は実ファイルパス由来で既に non-general なグループが付いているため、**docsMap では動かせない**。動かすには `lib/source-kit.mjs` の編集(最終手段、スキル更新のたび再適用が必要)か、web 側の実ディレクトリ構造変更が必要。今回はこの3グループを現状維持する判断をした。ChoiceBar を tool-ui と統合する案も出たが同じ理由で見送り。

## ChatContext 依存コンポーネント

- Thread / Composer / AssistantMessage / ChatStandingMascot / FeedbackModal は ChatContext 必須 → `cfg.provider` の `ChatPreviewProvider`（ds-entry-web.tsx 内、モック会話 2 メッセージ・isRunning: false）が全プレビューを包む
- モック会話を変えたいときは ds-entry-web.tsx の mockMessages を編集

## SpeechBubble の shared 移動 + MiniChatHeader 新規登録(2026-07-24)

web/lp/widget で3実装に分かれていたチャット吹き出しを `web/src/app/chat/components/SpeechBubble.tsx` → `shared/src/components/SpeechBubble.tsx` に一本化。あわせて `MiniChatHeader`（lp/widget のミニチャットヘッダー）を新規のshared内蔵コンポーネントとして追加登録した。

- **componentSrcMap のパスは shared 内蔵なら `src/components/<Name>.tsx`**（`ChatMarkdown`/`AmbientBG`/`Mascot` と同じ規約）。`../shared/src/...` のような `../` prefix は不要（PKG_DIR が既に shared/ のため）
- **落とし穴**: componentSrcMap のパスから `chat`/`web`/`poll` のようなパスセグメントが消えると、非 general グループへの自動分類が外れて `general` バケットに落ちる。SpeechBubble が web → shared 移動で `chat` グループを失い `general` に落ちたため、`ChatMarkdown`/`MiniChatHeader` と同じ `minichat` カテゴリに docsMap で明示的に再分類した(`.design-sync/groups/SpeechBubble.md`)。**コンポーネントを shared 側に移動するときは、旧グループを docsMap で引き継ぐ必要がないか必ず確認すること**
- `ds-entry-web.tsx` から SpeechBubble の re-export は削除(shared 内蔵になったため web からの持ち出しが不要に)
- sourceKey は移動前後で変化しない(ファイル内容が同じなら unchanged 判定・再グレード不要)。ただし出力パスが変わるため upload 対象には含まれる(旧 `components/chat/SpeechBubble/*` の delete + 新 `components/minichat/SpeechBubble/*` の write)
- `MiniChatHeader` の dtsPropsFor: `iconSrc?: string; action?: React.ReactNode; className?: string;`。overrides で `cardMode: "column"`（横長ヘッダーのため ModalHeader と同じ理由）
- re-sync 実施済み。projectId: 1615d9dd-b30a-4c91-8bd4-d4aa6a0f0c63、28コンポーネント、MiniChatHeader は Default/WithAction 2ストーリーとも good
