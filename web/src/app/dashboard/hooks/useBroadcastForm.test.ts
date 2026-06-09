import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import type { BroadcastMessage } from "~/types";
import { MAX_PARTS, useBroadcastForm } from "./useBroadcastForm";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const renderForm = (
  props?: Partial<Parameters<typeof useBroadcastForm>[0]>,
) => {
  const onClose = vi.fn();
  const r = renderHookWithQuery(() =>
    useBroadcastForm({
      mode: "create",
      onClose,
      ...props,
    }),
  );
  return { ...r, onClose };
};

describe("初期状態", () => {
  it("create: 空のテキストパート 1 件と timing=now で開く", () => {
    const { result } = renderForm();
    expect(result.current.parts).toHaveLength(1);
    expect(result.current.parts[0].type).toBe("text");
    expect(result.current.timing).toBe("now");
    expect(result.current.isValid).toBe(false);
  });

  it("edit: scheduledAt があれば timing=schedule、空 body は無効", () => {
    const broadcast: BroadcastMessage = {
      id: "b-1",
      title: "x",
      body: "hello",
      parts: null,
      status: "scheduled",
      scheduledAt: "2030-01-01T10:00:00.000Z",
      sentAt: null,
      errorMessage: null,
      createdBy: "admin",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: null,
    };

    const { result } = renderForm({
      mode: "edit",
      broadcast,
      onClose: () => {},
    });

    expect(result.current.timing).toBe("schedule");
    expect(result.current.scheduledAt).toBe("2030-01-01T10:00");
    expect(result.current.parts[0]).toMatchObject({
      type: "text",
      text: "hello",
    });
  });
});

describe("バリデーション", () => {
  it("テキストが空白のみだと isValid=false", () => {
    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "   ",
      }),
    );
    expect(result.current.isValid).toBe(false);
  });

  it("schedule で scheduledAt 未入力なら isValid=false", () => {
    const { result } = renderForm();
    act(() => {
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "hi",
      });
      result.current.setTiming("schedule");
    });
    expect(result.current.isValid).toBe(false);
  });

  it("now で text を入れたら isValid=true", () => {
    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "hi",
      }),
    );
    expect(result.current.isValid).toBe(true);
  });

  it("画像パートは imageR2Key があれば isValid=true", () => {
    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "image",
        imageR2Key: "k.jpg",
      }),
    );
    expect(result.current.isValid).toBe(true);
  });

  it("画像パートは file があれば imageR2Key 無しでも isValid=true", () => {
    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "image",
        imageR2Key: "",
        file: new File(["x"], "a.png", { type: "image/png" }),
      }),
    );
    expect(result.current.isValid).toBe(true);
  });

  it("画像パートは imageR2Key も file も無いと isValid=false", () => {
    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "image",
        imageR2Key: "",
      }),
    );
    expect(result.current.isValid).toBe(false);
  });
});

describe("parts 操作", () => {
  it("handleAddPart で末尾に追加、MAX_PARTS を超えない", () => {
    const { result } = renderForm();
    for (let i = 0; i < MAX_PARTS + 2; i++) {
      act(() => result.current.handleAddPart());
    }
    expect(result.current.parts).toHaveLength(MAX_PARTS);
  });

  it("handlePartRemove で削除", () => {
    const { result } = renderForm();
    act(() => result.current.handleAddPart());
    expect(result.current.parts).toHaveLength(2);
    act(() => result.current.handlePartRemove(0));
    expect(result.current.parts).toHaveLength(1);
  });

  it("handlePartMove down で位置入れ替え", () => {
    const { result } = renderForm();
    act(() => result.current.handleAddPart());
    const first = result.current.parts[0].id;
    const second = result.current.parts[1].id;

    act(() => result.current.handlePartMove(0, "down"));

    expect(result.current.parts[0].id).toBe(second);
    expect(result.current.parts[1].id).toBe(first);
  });

  it("handlePartMove up で位置入れ替え", () => {
    const { result } = renderForm();
    act(() => result.current.handleAddPart());
    const first = result.current.parts[0].id;
    const second = result.current.parts[1].id;

    act(() => result.current.handlePartMove(1, "up"));

    expect(result.current.parts[0].id).toBe(second);
    expect(result.current.parts[1].id).toBe(first);
  });
});

describe("handleSubmit", () => {
  it("now + create + confirm=true で createBroadcast を呼んで onClose", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let posted: unknown = null;
    server.use(
      http.post(`${API}/admin/broadcast`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ id: "b-1" }, { status: 201 });
      }),
    );

    const { result, onClose } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "hi",
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(posted).toMatchObject({
      parts: [{ type: "text", text: "hi" }],
      sendNow: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("now + confirm=false なら API を叩かず onClose も呼ばない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    let called = 0;
    server.use(
      http.post(`${API}/admin/broadcast`, () => {
        called += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result, onClose } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "hi",
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(called).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("isValid=false なら何もしない", async () => {
    let called = 0;
    server.use(
      http.post(`${API}/admin/broadcast`, () => {
        called += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result, onClose } = renderForm();

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(called).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("schedule + create で scheduledAt 付きで送信", async () => {
    let posted: { scheduledAt?: string } | null = null;
    server.use(
      http.post(`${API}/admin/broadcast`, async ({ request }) => {
        posted = (await request.json()) as { scheduledAt?: string };
        return HttpResponse.json({ id: "b-1" }, { status: 201 });
      }),
    );

    const { result } = renderForm();
    act(() => {
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "hi",
      });
      result.current.setTiming("schedule");
      result.current.setScheduledAt("2030-01-01T10:00");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect((posted as { scheduledAt?: string } | null)?.scheduledAt).toBe(
      new Date("2030-01-01T10:00").toISOString(),
    );
  });

  it("file 付き画像パートは upload-image でアップロードしてから送信", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let uploadCalled = 0;
    let posted: { parts?: unknown } | null = null;
    server.use(
      http.post(`${API}/admin/broadcast/upload-image`, () => {
        uploadCalled += 1;
        return HttpResponse.json({
          imageR2Key: "uploaded.jpg",
          imageDescription: "猫",
        });
      }),
      http.post(`${API}/admin/broadcast`, async ({ request }) => {
        posted = (await request.json()) as { parts?: unknown };
        return HttpResponse.json({ id: "b-1" }, { status: 201 });
      }),
    );

    const { result, onClose } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "image",
        imageR2Key: "",
        file: new File(["x"], "a.png", { type: "image/png" }),
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(uploadCalled).toBe(1);
    expect(posted).toMatchObject({
      parts: [
        { type: "image", imageR2Key: "uploaded.jpg", imageDescription: "猫" },
      ],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("file の無い既存画像パートは upload せず imageR2Key をそのまま送信", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let uploadCalled = 0;
    let posted: { parts?: unknown } | null = null;
    server.use(
      http.post(`${API}/admin/broadcast/upload-image`, () => {
        uploadCalled += 1;
        return HttpResponse.json({ imageR2Key: "x.jpg" });
      }),
      http.post(`${API}/admin/broadcast`, async ({ request }) => {
        posted = (await request.json()) as { parts?: unknown };
        return HttpResponse.json({ id: "b-1" }, { status: 201 });
      }),
    );

    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "image",
        imageR2Key: "existing.jpg",
        imageDescription: "犬",
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(uploadCalled).toBe(0);
    expect(posted).toMatchObject({
      parts: [
        { type: "image", imageR2Key: "existing.jpg", imageDescription: "犬" },
      ],
    });
  });

  it("now + edit で update してから send を呼ぶ", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let updated: { parts?: unknown } | null = null;
    let sentId: string | null = null;
    server.use(
      http.put(`${API}/admin/broadcast/:id`, async ({ request, params }) => {
        updated = (await request.json()) as { parts?: unknown };
        return HttpResponse.json({ id: params.id });
      }),
      http.post(`${API}/admin/broadcast/:id/send`, ({ params }) => {
        sentId = params.id as string;
        return HttpResponse.json({ id: params.id });
      }),
    );

    const broadcast: BroadcastMessage = {
      id: "b-9",
      title: "x",
      body: "old",
      parts: null,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      errorMessage: null,
      createdBy: "admin",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: null,
    };

    const { result, onClose } = renderForm({ mode: "edit", broadcast });
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "new",
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(updated).toMatchObject({ parts: [{ type: "text", text: "new" }] });
    expect(sentId).toBe("b-9");
    expect(onClose).toHaveBeenCalled();
  });

  it("schedule + edit は update のみで send は呼ばない", async () => {
    let updated: { scheduledAt?: string } | null = null;
    let sendCalled = 0;
    server.use(
      http.put(`${API}/admin/broadcast/:id`, async ({ request, params }) => {
        updated = (await request.json()) as { scheduledAt?: string };
        return HttpResponse.json({ id: params.id });
      }),
      http.post(`${API}/admin/broadcast/:id/send`, ({ params }) => {
        sendCalled += 1;
        return HttpResponse.json({ id: params.id });
      }),
    );

    const broadcast: BroadcastMessage = {
      id: "b-10",
      title: "x",
      body: "old",
      parts: null,
      status: "scheduled",
      scheduledAt: "2030-01-01T10:00:00.000Z",
      sentAt: null,
      errorMessage: null,
      createdBy: "admin",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: null,
    };

    const { result, onClose } = renderForm({ mode: "edit", broadcast });
    act(() => {
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "rescheduled",
      });
      result.current.setScheduledAt("2030-02-02T12:00");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect((updated as { scheduledAt?: string } | null)?.scheduledAt).toBe(
      new Date("2030-02-02T12:00").toISOString(),
    );
    expect(sendCalled).toBe(0);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("error state", () => {
  it("API が 500 なら isError=true / errorMessage を返す", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    server.use(
      http.post(`${API}/admin/broadcast`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    const { result } = renderForm();
    act(() =>
      result.current.handlePartChange(0, {
        id: result.current.parts[0].id,
        type: "text",
        text: "hi",
      }),
    );

    await act(async () => {
      try {
        await result.current.handleSubmit();
      } catch {
        // mutation 失敗で reject される設計なので無視
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBeTruthy();
  });
});
