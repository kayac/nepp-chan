# Nep-chan (ネップちゃん) 🦊

音威子府村コンパニオンAI「ネップちゃん」のプロジェクトです。

## セットアップ & 実行

### 依存関係のインストール
```bash
bun install
```

### 開発サーバーの起動
```bash
bun run dev
```
サーバーは `http://localhost:4112` で起動します。

---

## UI機能 (Web Interface)

Webインターフェース (`src/app/App.tsx`) から以下の機能にアクセスできます。

### サイドバー機能

#### 1. 基本操作
- **新しいチャット**: 新規スレッドを作成して会話を開始します。
- **記憶を整理 (Debug)**: 会話ログから長期記憶（Persona）を生成するバッチ処理を実行します。

#### 2. システム管理 (System Management)
アコーディオンメニューから以下の管理機能を利用できます。

- **🗑️ DB初期化**: データベースをリセットします（注意: データが消去されます）。
- **📚 知識埋め込み**: `knowledge/` ディレクトリのMarkdownファイルをベクトルDBに埋め込みます。
- **⚙️ 環境変数確認**: 必要な環境変数が設定されているか確認します。
- **🔍 ベクトル検索確認**: ベクトル検索が正常に動作するかテストします。
- **🛠️ ツール登録確認**: Mastraツールが正しく登録されているか確認します。
- **🧹 スレッド掃除**: 古いスレッドや空のスレッドを整理します。

#### 3. テストランナー (Test Runner)
- **🧪 テスト実行**: 指定した回数（人数分）のE2Eテストを実行します。
  - 入力欄で実行回数（1〜26）を指定可能。

### チャット画面
- **メッセージ送信**: ネップちゃんと会話できます。
- **ツール実行状況**: エージェントがツールを使用している間、その状況が表示されます（クリックで詳細展開）。
  - 記憶（Persona Recall/Record）
  - 村の様子（News Tool）
  - 村の知識（Knowledge Tool）
  - Web検索（Search Tool）など

---

## API エンドポイント

バックエンド (`src/server.ts`) が提供する主なAPIです。

### エージェント操作
- `POST /api/agents/Nep-chan/stream`
  - メッセージを送信し、ストリーミングレスポンスを受け取ります。

### スレッド管理
- `GET /api/threads/:resourceId`
  - 指定リソース（ユーザー）のスレッド一覧を取得します。
- `GET /api/threads/:threadId/messages`
  - 指定スレッドのメッセージ履歴を取得します。

### バッチ処理
- `POST /api/batch/memory`
  - 記憶生成バッチを実行します。

### システム管理
- `POST /api/system/init/db`: データベース初期化
- `POST /api/system/init/embeddings`: 知識データの埋め込み
- `GET /api/system/env`: 環境変数チェック
- `GET /api/system/check/vector`: ベクトル検索チェック
- `GET /api/system/check/tools`: ツール登録チェック
- `POST /api/system/cleanup/threads`: スレッドクリーンアップ

### テスト
- `POST /api/test/run`
  - E2Eテストを実行します。Body: `{ count: number }`
