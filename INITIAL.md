# nepch - ネップちゃん（音威子府村コンパニオンAI）

## FEATURE

Mastraベースの記憶蓄積型チャットアプリケーション。

### コア機能

1. **ペルソナ: ネップちゃん**
   - 音威子府村のコンパニオンAI
   - 🦊を必ずつけて話す（他の絵文字は文末に最大1つ）
   - 100文字以内でハキハキと会話
   - 観光客には村のオススメ、村人には共感的なカウンセリング

2. **Memory（記憶システム）**
   - **Working Memory**: ユーザー属性の蓄積
     - 年齢（推測含む）
     - 居住地／出身地（村内/村外/他地域）
     - 関係性（観光客/村人/学生/職員）
     - 関心テーマ（自然/アート/暮らし/人間関係）
     - 感情傾向（元気/悩み中/挑戦期）
     - 行動パターン（創作中心/旅行中/仕事中）
     - 重要情報の抜粋
   - **Conversation History**: 会話履歴
   - **Semantic Recall**: 過去の会話をベクター検索

3. **Knowledge（RAG）**
   - `./knowledge/*.md` の村情報をベクター化
   - 質問に対して正確な情報を検索・回答

4. **特殊モード**
   - `/dev`: 蓄積した記憶の可視化（デバッグ用）
   - `/master`: 村長専用モード（パスワード認証 → 全ユーザー横断検索）

5. **ストリーミングUI**
   - 「記憶を思い出し中...」の展開UI
   - ツール呼び出し内容 + メモリ検索結果を表示
   - 展開/折りたたみ可能

### 会話フロー

```
ユーザー入力
    ↓
Memory検索（セマンティック検索）
    ↓ [UI: 記憶を思い出し中...]
Knowledge検索（必要に応じて）
    ↓ [UI: 村の情報を確認中...]
LLM応答生成（ストリーミング）
    ↓ [UI: 思い出しました！...]
Working Memory更新（ユーザー属性）
```

## EXAMPLES

（MVPでは省略、必要に応じて追加）

## DOCUMENTATION

### Mastra公式ドキュメント

- **Memory**: https://mastra.ai/docs/memory/overview
  - Working Memory: https://mastra.ai/docs/memory/working-memory
  - Semantic Recall: https://mastra.ai/docs/memory/semantic-recall
  - Conversation History: https://mastra.ai/docs/memory/conversation-history

- **RAG**: https://mastra.ai/docs/rag/overview
  - Chunking: https://mastra.ai/docs/rag/chunking-and-embedding
  - Vector Databases: https://mastra.ai/docs/rag/vector-databases

- **Streaming**: https://mastra.ai/docs/streaming/overview
  - Events: https://mastra.ai/docs/streaming/events

- **LibSQL Vector**: https://mastra.ai/reference/memory/libsql

### AI SDK

- Vercel AI SDK: https://sdk.vercel.ai/docs

### LLM Providers

- Anthropic Claude: https://docs.anthropic.com/
- Google Gemini: https://ai.google.dev/docs

## OTHER CONSIDERATIONS

### 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Vite + React |
| バックエンド | Mastra |
| LLM | Claude / Gemini（.env切り替え） |
| Embedding | Google text-embedding-004 |
| Storage | LibSQLStore（SQLite） |
| Vector | LibSQLVector（SQLite） |
| パッケージ管理 | Bun |
| Lint/Format | Biome |

### 環境変数（.env）

```env
# LLM Provider（claude または gemini）
LLM_PROVIDER=gemini

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Master Mode Password
MASTER_PASSWORD=your-secure-password
```

### ディレクトリ構成（想定）

```
nepch/
├── src/
│   ├── mastra/
│   │   ├── index.ts          # Mastra instance
│   │   ├── agents/
│   │   │   └── nep-chan.ts   # ネップちゃんAgent
│   │   └── tools/
│   │       ├── memory-tool.ts
│   │       └── knowledge-tool.ts
│   ├── app/                   # React App
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Chat.tsx
│   │   │   ├── Message.tsx
│   │   │   └── ThinkingIndicator.tsx  # 展開UI
│   │   └── hooks/
│   │       └── useChat.ts
│   └── scripts/
│       └── embed-knowledge.ts  # Knowledge埋め込みスクリプト
├── knowledge/
│   └── otoineppu.md           # 村の情報
├── .env
├── package.json
└── biome.json
```

### 注意点・Gotchas

1. **Embeddingモデル固定**
   - Google text-embedding-004 を使用
   - 途中で変更すると全データ再Embedding必要

2. **LibSQLの制約**
   - ローカルファイル（`file:./local.db`）で動作
   - 本番ではTurso等への移行を検討

3. **ストリーミングUI**
   - Mastraの`stream`イベントを適切にハンドリング
   - `tool-call`/`tool-result`イベントで展開UIを制御

4. **Working Memoryのスコープ**
   - `scope: "resource"` でユーザー横断の記憶を実現（/masterモード用）
   - 通常は`scope: "thread"`でユーザー別

5. **セキュリティ**
   - /masterモードはパスワード認証必須
   - 村民データは外部送信される（Google Embedding API）
