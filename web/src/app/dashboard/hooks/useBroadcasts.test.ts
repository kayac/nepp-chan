import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useBroadcasts,
  useCreateBroadcast,
  useDeleteBroadcast,
  useSendBroadcast,
  useUpdateBroadcast,
  useUploadBroadcastImage,
} from "./useBroadcasts";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useBroadcasts", () => {
  it("status フィルタがクエリに含まれる", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/broadcast`, ({ request }) => {
        received = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({ broadcasts: [], nextCursor: null });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      useBroadcasts(20, { status: "draft" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toBe("draft");
  });
});

describe("broadcast mutations", () => {
  it("useCreateBroadcast: 成功で id を返す", async () => {
    server.use(
      http.post(`${API}/admin/broadcast`, () =>
        HttpResponse.json(
          {
            id: "b-1",
            title: null,
            messageType: "text",
            content: "hello",
            metadata: null,
            scheduledAt: null,
            sentAt: null,
            status: "draft",
            createdAt: "x",
            updatedAt: "x",
          },
          { status: 201 },
        ),
      ),
    );

    const { result } = renderHookWithQuery(() => useCreateBroadcast());

    let returned:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        parts: [{ type: "text", text: "hello" }],
      });
    });
    expect(returned?.id).toBe("b-1");
  });

  it("useDeleteBroadcast: 成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/broadcast/b-1`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteBroadcast());

    await act(async () => {
      await result.current.mutateAsync("b-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useSendBroadcast: 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/broadcast/b-1/send`, () =>
        HttpResponse.json({ message: "sent" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useSendBroadcast());

    await act(async () => {
      await result.current.mutateAsync("b-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useUpdateBroadcast: 成功で isSuccess", async () => {
    server.use(
      http.put(`${API}/admin/broadcast/b-1`, () =>
        HttpResponse.json({
          id: "b-1",
          title: null,
          messageType: "text",
          content: "y",
          metadata: null,
          scheduledAt: null,
          sentAt: null,
          status: "draft",
          createdAt: "x",
          updatedAt: "x",
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useUpdateBroadcast());

    await act(async () => {
      await result.current.mutateAsync({
        id: "b-1",
        data: { parts: [{ type: "text", text: "y" }] },
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useUploadBroadcastImage: 成功で imageR2Key を返す", async () => {
    server.use(
      http.post(`${API}/admin/broadcast/upload-image`, () =>
        HttpResponse.json({ imageR2Key: "img-k" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useUploadBroadcastImage());

    let returned:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(
        new File(["x"], "p.jpg", { type: "image/jpeg" }),
      );
    });
    expect(returned?.imageR2Key).toBe("img-k");
  });
});
