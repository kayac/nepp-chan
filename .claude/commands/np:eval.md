---
description: Eval V2 対話型テスト - ナレッジエージェントの回答品質をスコアリング＆可視化
argument-hint: [質問テキスト]
---

<role>
You are an AI evaluation specialist for the nepp-chan knowledge agent.
You run repeated scoring tests, visualize results, and provide actionable improvement advice.
</role>

<language>
- Communicate: 日本語
- Technical terms: 原語のまま
</language>

<reference>

## eval V2 コマンド

```bash
# 単一環境
pnpm eval:v2 -- --question "<質問>" --truth "<正解>" --n <回数>
pnpm eval:v2 -- --env development --question "<質問>" --truth "<正解>" --n <回数>
pnpm eval:v2 -- --case <index> --n <回数>

# 3環境比較
pnpm eval:v2 -- --compare --question "<質問>" --truth "<正解>" --n <回数>
pnpm eval:v2 -- --compare --category <education|garbage|village> --n <回数>
pnpm eval:v2 -- --compare --n <回数>  # 全テストケース
```

## 環境と接続先

| env | Vectorize | R2 |
|---|---|---|
| `local` | `nepp-chan-knowledge-local` | `nepp-chan-knowledge-local` |
| `development` | `nepp-chan-knowledge-dev` | `nepp-chan-knowledge-dev` |
| `production` | `nepp-chan-knowledge-prd` | `nepp-chan-knowledge-prd` |

`--env` オプションで環境指定（デフォルト: `local`）。`--compare` で local → development → production の順に実行し比較HTMLを生成。

## 5つのスコア指標

| 指標 | 英語名 | 意味 | 理想値 |
|------|--------|------|--------|
| 類似度 | similarity | 回答と正解の意味的な近さ | 1.0 |
| 忠実度 | faithfulness | 回答が検索結果に基づいているか | 1.0 |
| 文脈精度 | contextPrecision | 検索結果のうち正解に関連するものの割合 | 1.0 |
| 文脈関連度 | contextRelevance | 検索結果が質問にどれだけ関連しているか | 1.0 |
| 幻覚度 | hallucination | 検索結果にない情報を捏造していないか | 0.0 |

## テストケースマスター

`server/scripts/data/eval-test-cases.ts`（22個）。V2/V3 共有。

| カテゴリ | 件数 | 内容 |
|---------|:----:|------|
| education | 12 | 高校（寮費、入試、部活、Wi-Fi等） |
| garbage | 4 | ゴミ（ペットボトル、分別、カレンダー） |
| village | 6 | 村全体（村長、宿泊、食事、アクセス等） |

`--category` でカテゴリ別実行可能。

</reference>

<workflow>

### Step 1: パラメータ収集

引数があればそれを質問テキストとして使用。なければ AskUserQuestion で収集:

```yaml
AskUserQuestion:
  questions:
    - question: "テストモードを選んでください"
      header: "モード"
      multiSelect: false
      options:
        - label: "3環境比較（推奨）"
          description: "local/dev/prd を順次実行し比較HTMLレポートを生成"
        - label: "単一環境テスト"
          description: "特定の環境のみでテスト（環境を別途選択）"
    - question: "テストする質問は何ですか？"
      header: "質問"
      multiSelect: false
      options:
        - label: "全テストケース（22個）"
          description: "education/garbage/village 全カテゴリをまとめて実行"
        - label: "カテゴリから選ぶ"
          description: "education(12個)/garbage(4個)/village(6個) を選択"
        - label: "カスタム質問を入力"
          description: "質問と正解を直接指定"
    - question: "何回繰り返しますか？"
      header: "回数"
      multiSelect: false
      options:
        - label: "3回（クイック）"
          description: "動作確認・デバッグ向け"
        - label: "10回（標準）"
          description: "傾向を見るのに十分"
        - label: "30回（詳細）"
          description: "統計的に信頼できる結果"
```

「カテゴリから選ぶ」の場合、追加で AskUserQuestion:

```yaml
AskUserQuestion:
  questions:
    - question: "テストするカテゴリを選んでください"
      header: "カテゴリ"
      multiSelect: false
      options:
        - label: "education（12個）"
          description: "高校関連（寮費、入試、部活、Wi-Fi等）"
        - label: "garbage（4個）"
          description: "ゴミ関連（ペットボトル、分別、カレンダー）"
        - label: "village（6個）"
          description: "村全体（村長、宿泊、食事、アクセス等）"
```

カスタム質問の場合、追加で質問テキストと正解（groundTruth）を聞く。
単一環境テストの場合、環境（local / development / production）を追加で聞く。
3環境比較モードは全テストケース・カテゴリ・カスタム質問のいずれとも組み合わせ可能。複数テストケースの場合、個別比較HTML＋統合サマリーHTMLが生成される。

### Step 2: テスト実行

単一環境モード:
```bash
pnpm eval:v2 -- --env <環境> --n <回数>                                          # 全テストケース
pnpm eval:v2 -- --env <環境> --category <education|garbage|village> --n <回数>    # カテゴリ指定
pnpm eval:v2 -- --env <環境> --question "<質問>" --truth "<正解>" --n <回数>      # カスタム質問
```

3環境比較モード（`--compare`）:
```bash
pnpm eval:v2 -- --compare --n <回数>                                             # 全テストケース
pnpm eval:v2 -- --compare --category <education|garbage|village> --n <回数>       # カテゴリ指定
pnpm eval:v2 -- --compare --question "<質問>" --truth "<正解>" --n <回数>         # カスタム質問
```

複数テストケース × 3環境比較の場合、個別比較HTML＋統合サマリーHTMLが自動生成される。

`run_in_background` で実行。完了通知を待つ。

**重要**: プロセス完了後、出力された JSON ファイルを読み取って結果を取得する。

### Step 3: 結果表示

AskUserQuestion で表示方法を選択:

```yaml
AskUserQuestion:
  questions:
    - question: "結果をどう表示しますか？"
      header: "表示"
      multiSelect: false
      options:
        - label: "HTMLレポートを開く"
          description: "ブラウザでレーダーチャート＋比較テーブルを表示"
        - label: "ターミナルで確認"
          description: "ASCIIバーグラフ＋サマリーをここに表示"
        - label: "両方"
          description: "HTMLを開きつつターミナルにもサマリー表示"
```

### Step 4: ASCII可視化（ターミナル表示の場合）

#### 単一環境モード

```
═══════════════════════════════════════════
📊 Eval V2 結果レポート
═══════════════════════════════════════════
質問: {question}
正解: {groundTruth}
環境: {environment}
実行: {completedIterations}/{iterations} 回
時間: {totalDurationMs/1000}s

─── スコア ────────────────────────────────
類似度 (similarity)      |████████░░| 0.820  正解との意味的な近さ
忠実度 (faithfulness)    |██████░░░░| 0.600  検索結果に基づいた回答か
文脈精度 (contextPrec.)  |█████████░| 0.900  検索結果の正確さ
文脈関連 (contextRel.)   |███████░░░| 0.700  検索結果の関連度
幻覚度 (hallucination)   |█░░░░░░░░░| 0.100  捏造の少なさ（低いほど良い）

─── ばらつき ──────────────────────────────
           avg    σ     min    max
similarity 0.820  0.050 0.700  0.900
faithful.  0.600  0.120 0.400  0.800
ctx.prec.  0.900  0.030 0.850  0.950
ctx.rel.   0.700  0.080 0.550  0.800
halluc.    0.100  0.040 0.050  0.200

─── トークン消費 ──────────────────────────
合計: 125,000 (prompt: 100,000 / completion: 25,000)
平均/回: 12,500 (prompt: 10,000 / completion: 2,500)
═══════════════════════════════════════════
```

#### 3環境比較モード

```
═══════════════════════════════════════════════════
📊 Eval V2 3環境比較レポート
═══════════════════════════════════════════════════
質問: {question}
正解: {groundTruth}

─── スコア比較 ────────────────────────────────────
               local    dev      prd      改善率
similarity     0.850    0.820    0.700    +21.4%
faithfulness   0.700    0.650    0.600    +16.7%
ctx.precision  1.000    0.950    0.900    +11.1%
ctx.relevance  0.800    0.750    0.700    +14.3%
hallucination  0.050    0.100    0.200    +75.0%

─── 性能比較 ──────────────────────────────────────
         完了    時間      トークン
local    3/3     45.2s     37,500
dev      3/3     48.1s     38,200
prd      3/3     47.5s     37,800
═══════════════════════════════════════════════════
```

### Step 5: 診断コメント

結果を分析して以下を提供:

1. **一言コメント**: 全体的な品質を一文で評価
2. **指標ごとの解説**: 各スコアが何を意味するか日本語で説明
3. **環境間の差分分析**（比較モード時）: どの環境のナレッジが最も品質が高いか
4. **改善アドバイス**: スコアが低い指標について具体的な改善提案
   - similarity 低い → 回答フォーマットの調整、instructions の改善
   - faithfulness 低い → ナレッジの充実、エージェントのプロンプト改善
   - contextPrecision 低い → ナレッジのチャンク分割戦略の見直し
   - contextRelevance 低い → 検索クエリの改善、embedding の品質
   - hallucination 高い → instructions に「検索結果のみに基づいて回答」を強化
5. **壁打ち**: ユーザーに改善の方向性を提案し、対話で深掘り

### Step 6: 壁打ち（任意）

```yaml
AskUserQuestion:
  questions:
    - question: "次にどうしますか？"
      header: "次のアクション"
      multiSelect: false
      options:
        - label: "同じ質問で再テスト"
          description: "パラメータ変更や改善後の効果を確認"
        - label: "別の質問でテスト"
          description: "新しい質問で品質を確認"
        - label: "改善策を議論"
          description: "スコア改善のための具体的な施策を壁打ち"
        - label: "終了"
          description: "テストセッションを終了"
```

</workflow>

<constraints>
- テスト実行中は `run_in_background` を使い、完了通知を待つ
- hallucination は「低いほど良い」ことを必ず明記する（他の指標と逆）
- 結果 JSON/HTML は `dataset/eval/results/` に自動保存される（.gitignore 対象）
- 30回以上のテストは時間がかかることを事前に伝える（1回あたり約60秒）
- 壁打ちでは推測ではなくデータに基づいた提案をする
- 3環境比較は3倍の時間がかかることを事前に伝える
</constraints>
