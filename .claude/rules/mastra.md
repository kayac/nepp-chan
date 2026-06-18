---
paths:
  - server/src/mastra/**
---

# Mastra 規約

## パス別名

```typescript
import { something } from "~/middleware"; // ~ = src/
```

## 配置ルール

- `mastra/agents/` - Agent のみ
- `mastra/tools/` - Tool のみ
- `mastra/workflows/` - Workflow のみ
- `services/` - ビジネスロジック（Mastra プリミティブ以外）

## Agent フォールバック

フォールバックエントリの `id` は必ず明示する。省略すると Agent 構築時の `randomUUID()` が workerd のグローバルスコープ制約に抵触する。

## createTool シグネチャ

```typescript
execute: async (inputData, context) => {
  const env = context?.requestContext?.get("env") as CloudflareBindings;
  // inputData は inputSchema のフィールドを直接持つ
};
```

## D1Store 初期化

```typescript
const storage = new D1Store({ id: "mastra-storage", binding: db });
await storage.init(); // 必須
```
