import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import type { Poll } from "~/types";
import { usePollForm } from "./usePollForm";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const renderForm = (poll?: Poll) => {
  const onClose = vi.fn();
  const r = renderHookWithQuery(() => usePollForm({ poll, onClose }));
  return { ...r, onClose };
};

describe("初期状態", () => {
  it("新規モード: 空タイトル + 空選択肢 2 件で isValid=false", () => {
    const { result } = renderForm();
    expect(result.current.title).toBe("");
    expect(result.current.choices).toHaveLength(2);
    expect(result.current.isValid).toBe(false);
    expect(result.current.isEditMode).toBe(false);
  });

  it("編集モード: poll の値で初期化", () => {
    const poll: Poll = {
      id: "p-1",
      title: "好きな色は？",
      choices: ["赤", "青"],
      followUpPrompt: "なぜ？",
      status: "draft",
      createdBy: "admin",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: null,
      scheduledAt: null,
      sentAt: null,
      closedAt: null,
      answerCount: 0,
    };
    const { result } = renderForm(poll);
    expect(result.current.title).toBe("好きな色は？");
    expect(result.current.choices.map((c) => c.value)).toEqual(["赤", "青"]);
    expect(result.current.followUpPrompt).toBe("なぜ？");
    expect(result.current.isEditMode).toBe(true);
  });
});

describe("choices 操作", () => {
  it("addChoice で末尾に追加", () => {
    const { result } = renderForm();
    act(() => result.current.addChoice());
    expect(result.current.choices).toHaveLength(3);
  });

  it("updateChoice で値を更新", () => {
    const { result } = renderForm();
    const firstId = result.current.choices[0].id;
    act(() => result.current.updateChoice(firstId, "更新値"));
    expect(result.current.choices[0].value).toBe("更新値");
  });

  it("removeChoice で削除", () => {
    const { result } = renderForm();
    act(() => result.current.addChoice());
    const removeId = result.current.choices[0].id;
    act(() => result.current.removeChoice(removeId));
    expect(
      result.current.choices.find((c) => c.id === removeId),
    ).toBeUndefined();
  });
});

describe("バリデーション", () => {
  it("タイトルと有効選択肢 2 件以上で isValid=true", () => {
    const { result } = renderForm();
    act(() => {
      result.current.setTitle("お題");
      result.current.updateChoice(result.current.choices[0].id, "A");
      result.current.updateChoice(result.current.choices[1].id, "B");
    });
    expect(result.current.isValid).toBe(true);
  });

  it("タイトルが空ならまだ isValid=false", () => {
    const { result } = renderForm();
    act(() => {
      result.current.updateChoice(result.current.choices[0].id, "A");
      result.current.updateChoice(result.current.choices[1].id, "B");
    });
    expect(result.current.isValid).toBe(false);
  });
});

describe("handleSubmit", () => {
  it("新規 + sendNow=false で createPoll を呼ぶ", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API}/admin/polls`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "p-1" }, { status: 201 });
      }),
    );

    const { result, onClose } = renderForm();
    act(() => {
      result.current.setTitle("Q");
      result.current.updateChoice(result.current.choices[0].id, "A");
      result.current.updateChoice(result.current.choices[1].id, "B");
    });

    await act(async () => {
      await result.current.handleSubmit(false);
    });

    expect((body as { title?: string; sendNow?: boolean })?.title).toBe("Q");
    expect((body as { sendNow?: boolean })?.sendNow).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it("新規 + sendNow=true + confirm=true で sendNow:true を送信", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let body: { sendNow?: boolean } | null = null;
    server.use(
      http.post(`${API}/admin/polls`, async ({ request }) => {
        body = (await request.json()) as { sendNow?: boolean };
        return HttpResponse.json({ id: "p-2" }, { status: 201 });
      }),
    );

    const { result } = renderForm();
    act(() => {
      result.current.setTitle("Q");
      result.current.updateChoice(result.current.choices[0].id, "A");
      result.current.updateChoice(result.current.choices[1].id, "B");
    });

    await act(async () => {
      await result.current.handleSubmit(true);
    });

    expect((body as { sendNow?: boolean } | null)?.sendNow).toBe(true);
  });

  it("新規 + sendNow=true + confirm=false で API を呼ばない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    let called = 0;
    server.use(
      http.post(`${API}/admin/polls`, () => {
        called += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result, onClose } = renderForm();
    act(() => {
      result.current.setTitle("Q");
      result.current.updateChoice(result.current.choices[0].id, "A");
      result.current.updateChoice(result.current.choices[1].id, "B");
    });

    await act(async () => {
      await result.current.handleSubmit(true);
    });

    expect(called).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("編集モードで updatePoll を呼ぶ", async () => {
    const poll: Poll = {
      id: "p-1",
      title: "Q",
      choices: ["A", "B"],
      followUpPrompt: null,
      status: "draft",
      createdBy: "admin",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: null,
      scheduledAt: null,
      sentAt: null,
      closedAt: null,
      answerCount: 0,
    };
    let called = false;
    server.use(
      http.put(`${API}/admin/polls/p-1`, () => {
        called = true;
        return HttpResponse.json({ id: "p-1" });
      }),
    );

    const { result } = renderForm(poll);
    await act(async () => {
      await result.current.handleSubmit(false);
    });

    await waitFor(() => expect(called).toBe(true));
  });
});
