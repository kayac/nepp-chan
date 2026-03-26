# クエリリファレンス

## 実行方法

```bash
# server/ ディレクトリから実行
npx wrangler d1 execute {db_name} --env {env} --remote --command "SQL" --json
```

| 環境 | db_name | env |
|------|---------|-----|
| dev | nepp-chan-db-dev | development |
| prd | nepp-chan-db-prd | production |

`--remote` 必須（なしだとローカル DB を参照する）

## タイムゾーン

- DB の `createdAt` / `created_at` / `conversation_ended_at` は **UTC**
- 表示は **JST（UTC+9）** で行う
- 変換: JST の日時から9時間引く（例: JST 2/17 00:00 → UTC 2/16T15:00:00）

## テーブル

### mastra_messages

| カラム | 型 | 説明 |
|--------|----|------|
| id | TEXT PK | |
| thread_id | TEXT | スレッド ID |
| content | TEXT | メッセージ本文 |
| role | TEXT | `user` or `assistant` |
| type | TEXT | |
| createdAt | TIMESTAMP | UTC |
| resourceId | TEXT | ユーザー識別子 |

### mastra_threads

| カラム | 型 | 説明 |
|--------|----|------|
| id | TEXT PK | |
| title | TEXT | |
| metadata | TEXT | |
| resourceId | TEXT | |
| createdAt | TIMESTAMP | UTC |
| updatedAt | TIMESTAMP | UTC |

### persona（トピック分析用）

| カラム | 型 | 説明 |
|--------|----|------|
| id | TEXT PK | |
| resource_id | TEXT | ユーザー識別子 |
| category | TEXT | 関心事/要望/好み/困りごと/意見 等 |
| topic | TEXT | 観光/行政/生活/教育/交通/買い物/医療/除雪 等 |
| content | TEXT | 内容 |
| created_at | TEXT | UTC |
| conversation_ended_at | TEXT | 会話日時 UTC |

## 重要な定数

- 公開日: 2026-02-17 JST（UTC: 2026-02-16T15:00:00）
- それ以前のデータはテスト
- 往復数 = assistant の応答数（user と概ね 1:1 だが微差あり）
- `resourceId` = Web: ブラウザ生成 UUID / LINE: LINE userId

## クエリパターン

### 1. 全期間サマリー

```sql
SELECT
  COUNT(CASE WHEN role='user' THEN 1 END) as user_msgs,
  COUNT(CASE WHEN role='assistant' THEN 1 END) as assistant_msgs,
  COUNT(DISTINCT thread_id) as threads,
  COUNT(DISTINCT CASE WHEN role='user' THEN resourceId END) as unique_users
FROM mastra_messages
WHERE createdAt >= '2026-02-16T15:00:00'
```

### 2. 期間指定サマリー

JST の開始/終了を UTC に変換して指定。

```sql
WHERE createdAt >= '{start_utc}' AND createdAt < '{end_utc}'
```

### 3. 週別推移（往復 + アクティブユーザー）

CASE WHEN で週ラベルを付与。週境界は JST 基準で設定し UTC に変換。

```sql
SELECT
  CASE
    WHEN createdAt < '{week2_start_utc}' THEN '{week1_label}'
    WHEN createdAt < '{week3_start_utc}' THEN '{week2_label}'
    ...
    ELSE '{last_week_label}'
  END as week,
  COUNT(CASE WHEN role='assistant' THEN 1 END) as roundtrips,
  COUNT(DISTINCT CASE WHEN role='user' THEN resourceId END) as active_users
FROM mastra_messages
WHERE createdAt >= '{start_utc}'
GROUP BY week ORDER BY week
```

### 4. 週別新規ユーザー

初回発言日で分類。

```sql
WITH first_seen AS (
  SELECT resourceId, MIN(createdAt) as first_at
  FROM mastra_messages
  WHERE role='user' AND createdAt >= '2026-02-16T15:00:00'
  GROUP BY resourceId
)
SELECT
  CASE WHEN first_at < '{week2_start_utc}' THEN '{week1_label}' ... END as week,
  COUNT(*) as new_users
FROM first_seen GROUP BY week ORDER BY week
```

### 5. エンゲージメント分布

```sql
WITH user_msgs AS (
  SELECT resourceId, COUNT(*) as msg_count
  FROM mastra_messages
  WHERE role='user' AND createdAt >= '2026-02-16T15:00:00'
  GROUP BY resourceId
)
SELECT
  CASE
    WHEN msg_count = 1 THEN '1回'
    WHEN msg_count BETWEEN 2 AND 3 THEN '2-3回'
    WHEN msg_count BETWEEN 4 AND 10 THEN '4-10回'
    WHEN msg_count BETWEEN 11 AND 20 THEN '11-20回'
    ELSE '21回以上'
  END as bucket,
  COUNT(*) as users,
  SUM(msg_count) as total_msgs
FROM user_msgs GROUP BY bucket ORDER BY MIN(msg_count)
```

### 6. トピック分布（全期間）

persona テーブルの `topic` を集計。`conversation_ended_at` で期間指定可能。

```sql
SELECT topic, COUNT(*) as cnt
FROM persona
WHERE conversation_ended_at >= '2026-02-16T15:00:00'
  AND topic IS NOT NULL
GROUP BY topic ORDER BY cnt DESC
```

### 7. 週別トピック

```sql
SELECT
  CASE
    WHEN conversation_ended_at < '{week2_start_utc}' THEN '{week1_label}'
    ...
  END as week,
  topic,
  COUNT(*) as cnt
FROM persona
WHERE conversation_ended_at >= '{start_utc}'
  AND topic IS NOT NULL
GROUP BY week, topic ORDER BY week, cnt DESC
```

### 8. トピック別キーワード抽出

各トピックの `content` をサンプリングし、代表的なキーワードを抽出する。

```sql
SELECT content, topic FROM persona
WHERE conversation_ended_at >= '2026-02-16T15:00:00'
  AND topic IN ('観光','行政','生活','教育','交通','買い物','医療','除雪')
ORDER BY RANDOM() LIMIT 50
```

取得した content から固有名詞・具体的テーマを3〜5個ピックアップしてトピック行に付与する。

### 9. カテゴリ分布（全期間 or 期間指定）

```sql
SELECT category, COUNT(*) as cnt
FROM persona
WHERE conversation_ended_at >= '2026-02-16T15:00:00'
GROUP BY category ORDER BY cnt DESC
```
