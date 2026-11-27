# 白黒のチャット素体

キャラクターの装飾を持たない、白黒のチャット画面のデザイン。白い画面に、利用者の発言を黒い丸吹き出しで、回答を薄いグレーの丸吹き出しで置く。

この資料はデザインの受け渡しで、画面への組み込みは含まない。組み込み方は [決めていないこと](#決めていないこと) にまとめた。

## 入っているもの

| ファイル | 内容 |
|---|---|
| [sample.html](sample.html) | 6 画面を確定寸法の枠に収めた見本。単体でブラウザで開ける。寸法・色・余白はこの HTML と CSS が正 |
| `*.png` | 見本の各画面を書き出した画像。見本を同じ寸法で撮ると一致する |
| [theme-vanilla.css](../../../shared/src/styles/theme-vanilla.css) | 既存のデザイントークンを無彩色に張り替えるクラス `.theme-vanilla` |

| 画面 | 寸法 | 画像 |
|---|---|---|
| Web デスクトップ 初回 | 1440 × 900 | [desktop-start.png](desktop-start.png) |
| Web デスクトップ 会話中 | 1440 × 900 | [desktop-thread.png](desktop-thread.png) |
| Web スマホ 初回 | 390 × 844 | [mobile-start.png](mobile-start.png) |
| Web スマホ 会話中 | 390 × 844 | [mobile-thread.png](mobile-thread.png) |
| 埋め込みウィジェット 入力中 | 380 × 560 | [widget-thread.png](widget-thread.png) |
| LP ミニチャット 回答後 | 380 × 464 | [lp-mini-chat.png](lp-mini-chat.png) |

見本の会話例と質問候補は、組版確認用の仮文言。

## `.theme-vanilla` の範囲

`shared/src/styles/index.css` から読み込んでいるが、どの要素にも付けていない。既存の画面は変わらない。

要素にこのクラスを付けると、配下で次のトークンが変わる。

- 色: `--teal-*` `--snow-*` `--paper-*` と、それを参照する `--bg-*` `--fg-*` `--border-*` `--brand*`
- 形: `--r-bubble` が 23px、`--shadow-float-*` `--shadow-floating-input` `--shadow-brand` が影なし
- 書体: `--font-display` `--font-body` がシステム書体

クラスを付けただけでは、見本と同じ画面にはならない。トークンを参照していない箇所と、構造・文言の違いが残る。残る違いは次の節の表のとおり。

## 見本と現行コンポーネントの対応

参照コミットは `991bea16`。見本のクラス名は `sample.html` の中のもの。

| 見本の部品 | 現行のコンポーネント | クラスを付けても残る違い |
|---|---|---|
| 画面の地 `.screen` | `web/src/app/chat/ChatPage.tsx` の `ChatPage` | 背景画像と立ち絵 `ChatStandingMascot` が出る。見本は白地のみ |
| ヘッダー `.frame-header` | `web/src/app/chat/components/TopBar.tsx` の `TopBar` | ロゴ画像と BETA 表示が出る。見本は「チャット」の文字見出しと、直径 44px の履歴ボタン。高さは 68px、幅 520px 以下で 58px |
| 初回画面 `.start` | `web/src/app/chat/components/Landing.tsx` の `Landing` | マスコット、英字の小見出し、絵文字つきの質問候補が出る。見本は見出し・説明・質問候補 4 つ・入力欄。最大幅 520px、質問候補は 2 列、幅 520px 以下で 1 列 |
| 会話列 `.thread-rail` | `web/src/components/chat/Thread.tsx` の `Thread` | 列の最大幅が 42rem。見本は 640px で、入力欄と同じ幅。発言の間隔は 28px、幅 520px 以下で 23px |
| 話者名 `.speaker` | `web/src/components/chat/AssistantMessage.tsx` の `AssistantHeader` | アイコンとキャラクター名が出る。見本は「アシスタント」「あなた」の文字のみで、利用者側にも話者名がある |
| 回答の吹き出し `.turn-assistant .message` | `shared/src/components/SpeechBubble.tsx` の `assistant` | 地が白で枠線つき、左上の角だけ 10px。見本は地が `#F2F2F2`、枠線なし、四隅 23px、余白は上下 11px・左右 18px、最大幅 560px |
| 利用者の吹き出し `.turn-user .message` | `SpeechBubble` の `user`、`web/src/components/chat/UserMessage.tsx` | 直書きの影と、右上の角 10px が残る。見本は影なし、四隅 23px、最大幅は会話列の 88% |
| 評価 `.feedback` | `AssistantMessage.tsx` の `AssistantActionBar` `FeedbackButtons` | アイコンのボタンが 3 つ。見本は「はい」「いいえ」「提案する」の文字ボタン |
| 入力欄 `.composer` | `web/src/components/chat/Composer.tsx` の `Composer` | 2px の枠線と、送信ボタンの直書きの影が残る。見本は枠線なしで地が `#F2F2F2`、最小高さ 58px、送信ボタンは直径 44px の上向き矢印。入力が空のときのボタンの地は `#E5E5E5` |
| 埋め込みのヘッダー | `shared/src/components/MiniChatHeader.tsx` の `MiniChatHeader` | アイコン、キャラクター名、オンライン表示が出る。見本は「チャット」の文字見出しのみで、高さ 54px |
| 埋め込みウィジェット `.widget` | `widget/src/WidgetChat.tsx` の `WidgetChat` | 見本は本文 14px、左右余白 16px、入力欄の最小高さ 52px。下端に Web チャットへの導線 |
| LP ミニチャット `.mini` | `lp/src/components/lp/MiniChat.tsx` の `MiniChat` | 見本は回答後に、地が黒の「Webチャットで続ける」ボタン。高さ 44px |

本文は 16px、幅 520px 以下で 15px、行高は 1.85。話者名は 12px。画面の左右余白は 28px、幅 520px 以下で 18px、360px 以下で 16px。

## 決めていないこと

- このデザインをどこで使うか。既存の画面を置き換えるのか、別の構成として持つのか。
- 切り替えの仕組み。見本は `data-chat-theme="vanilla"` の属性で値を引いているが、`.theme-vanilla` はクラスにしている。どちらに寄せるかも含む。
- 構造の違いをどのコンポーネントで吸収するか。上の表は違いを並べただけで、実装方法は示していない。
- 文言。見本の見出し・説明・質問候補・話者名・入力欄の案内は仮のもの。
- 埋め込みウィジェットと LP ミニチャットの本文の大きさ。見本は 14px で、`DESIGN.md` の本文 15px と食い違う。
- 履歴パネル、生成中、通信エラー、ツール出力、管理画面の見た目。見本に含めていない。
- 端末のセーフエリアと、長文・改行・日本語変換・送信停止の動作。組み込みのときに確認が要る。
