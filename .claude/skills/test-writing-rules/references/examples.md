# 実例カタログ

このリポジトリでのテスト道具の使い方を、最小コード例で示す。観点（perspectives.md）と指針（SKILL.md「テスト道具の使い方」）を実コードに落とした形。

## server: Hono ルートテスト

`resolvePrincipal` + `errorHandler` 込みの本番同等アプリで叩く。

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { withResolvePrincipal } from "~/test-helpers/test-app";
import { createTestDb } from "~/test-helpers/test-db";
import { adminBroadcastRoutes } from "./broadcast";

describe("POST /admin/broadcast", () => {
  let env: CloudflareBindings;

  beforeEach(async () => {
    const db = await createTestDb();
    env = { DB: db /* ... */ } as CloudflareBindings;
  });

  it("scheduled_at が過去日時のとき 400 を返す", async () => {
    const app = await withResolvePrincipal(adminBroadcastRoutes);
    const res = await app.request(
      "/admin/broadcast",
      {
        method: "POST",
        body: JSON.stringify({ /* ... */ scheduled_at: "2020-01-01T00:00:00Z" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("scheduled_at_in_past");
  });
});
```

## server: Mastra tool テスト

`callTool` で `RuntimeContext` を組み立てて execute を直接呼ぶ。`env` を含むキーは必ず明示。

```ts
import { describe, expect, it } from "vitest";
import { callTool } from "~/test-helpers/tool-context";
import { emergencyReportTool } from "./emergency-report-tool";

describe("emergencyReportTool", () => {
  it("type が必須項目で欠落していたら ValidationError を返す", async () => {
    const result = await callTool(emergencyReportTool, {}, { env });

    expect(result.error?.code).toBe("validation");
  });
});
```

## server: DB を伴うサービステスト

`createTestDb` をテスト毎に作り直して状態を隔離。

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "~/test-helpers/test-db";
import { savePoll } from "./poll";

describe("savePoll", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("同じ id で 2 回呼ぶと UNIQUE 制約違反になる", async () => {
    await savePoll(db, { id: "p-1", title: "好きな季節" });

    await expect(savePoll(db, { id: "p-1", title: "別" })).rejects.toThrow(
      /UNIQUE/,
    );
  });
});
```

## web: フックテスト

`renderHookWithQuery` で QueryClient ごと包む。`server.use` を先に書く。

```ts
import { HttpResponse, http } from "msw";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import { useThreads } from "./useThreads";

describe("useThreads", () => {
  it("スレッド一覧を fetch して返す", async () => {
    server.use(
      http.get("*/threads", () =>
        HttpResponse.json({ items: [{ id: "t-1", title: "test" }] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useThreads());

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
  });
});
```

## web: コンポーネントテスト

`renderWithQuery` でラップし、ユーザー操作と結果を検証。

```ts
import { HttpResponse, http } from "msw";
import { userEvent } from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { FeedbackModal } from "./FeedbackModal";

describe("FeedbackModal", () => {
  it("送信成功時に閉じる", async () => {
    server.use(
      http.post("*/feedback", () => HttpResponse.json({ ok: true }, { status: 201 })),
    );
    const onClose = vi.fn();

    renderWithQuery(<FeedbackModal open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /送信/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

## 時刻依存テスト

`vi.useFakeTimers` で時刻を固定し、テスト終了時に必ず戻す。

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isExpired } from "./session";

describe("isExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires_at がちょうど現在時刻のとき expired と判定する", () => {
    expect(isExpired("2026-01-01T00:00:00Z")).toBe(true);
  });
});
```
