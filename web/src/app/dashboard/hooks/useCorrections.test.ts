import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useCorrections,
  useCreateCorrection,
  useRetireCorrection,
  useReverifyCorrection,
} from "./useCorrections";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useCorrections", () => {
  it("訂正一覧を取得する", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({ corrections: [{ id: "cor-1" }] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useCorrections());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.corrections).toHaveLength(1);
  });
});

describe("useCreateCorrection", () => {
  it("訂正を POST する", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${API}/admin/corrections`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          message: "ok",
          correction: { id: "cor-1" },
        });
      }),
    );

    const { result } = renderHookWithQuery(() => useCreateCorrection());
    await act(async () => {
      await result.current.mutateAsync({
        correctsSourcePath: "bus/index.md",
        body: "土曜は運休です",
        answerRunId: "ar-1",
      });
    });

    expect(capturedBody).toEqual({
      correctsSourcePath: "bus/index.md",
      body: "土曜は運休です",
      answerRunId: "ar-1",
    });
  });
});

describe("useRetireCorrection / useReverifyCorrection", () => {
  it("retire を POST する", async () => {
    server.use(
      http.post(`${API}/admin/corrections/cor-1/retire`, () =>
        HttpResponse.json({ message: "ok", correction: { id: "cor-1" } }),
      ),
    );

    const { result } = renderHookWithQuery(() => useRetireCorrection());
    await act(async () => {
      await result.current.mutateAsync("cor-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("reverify を POST する", async () => {
    server.use(
      http.post(`${API}/admin/corrections/cor-1/reverify`, () =>
        HttpResponse.json({ message: "ok", correction: { id: "cor-1" } }),
      ),
    );

    const { result } = renderHookWithQuery(() => useReverifyCorrection());
    await act(async () => {
      await result.current.mutateAsync("cor-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
