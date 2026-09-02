import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import { useCorrections } from "./useCorrections";
import {
  useBackfillSources,
  useKnowledgeSources,
  useUpdateSourceStatus,
} from "./useKnowledgeSources";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useKnowledgeSources", () => {
  it("情報源一覧を取得する", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({ sources: [{ sourcePath: "bus/index.md" }] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useKnowledgeSources());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.sources).toHaveLength(1);
  });
});

describe("useUpdateSourceStatus", () => {
  it("sourcePath と action を PATCH する", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.patch(
        `${API}/admin/knowledge/sources/status`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ message: "ok" });
        },
      ),
    );

    const { result } = renderHookWithQuery(() => useUpdateSourceStatus());
    await act(async () => {
      await result.current.mutateAsync({
        sourcePath: "bus/index.md",
        action: "disable",
      });
    });

    expect(capturedBody).toEqual({
      sourcePath: "bus/index.md",
      action: "disable",
    });
  });

  it("成功後は訂正一覧も再取得する", async () => {
    let correctionsFetchCount = 0;
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () =>
        HttpResponse.json({ sources: [] }),
      ),
      http.get(`${API}/admin/corrections`, () => {
        correctionsFetchCount += 1;
        return HttpResponse.json({ corrections: [] });
      }),
      http.patch(`${API}/admin/knowledge/sources/status`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const { result } = renderHookWithQuery(() => ({
      sources: useKnowledgeSources(),
      corrections: useCorrections(),
      update: useUpdateSourceStatus(),
    }));
    await waitFor(() => expect(correctionsFetchCount).toBe(1));

    await act(async () => {
      await result.current.update.mutateAsync({
        sourcePath: "bus/index.md",
        action: "disable",
      });
    });

    await waitFor(() => expect(correctionsFetchCount).toBe(2));
  });
});

describe("useBackfillSources", () => {
  it("backfill を POST して情報源一覧を再取得する", async () => {
    let sourcesFetchCount = 0;
    server.use(
      http.get(`${API}/admin/knowledge/sources`, () => {
        sourcesFetchCount += 1;
        return HttpResponse.json({ sources: [] });
      }),
      http.post(`${API}/admin/knowledge/sources/backfill`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const { result } = renderHookWithQuery(() => ({
      sources: useKnowledgeSources(),
      backfill: useBackfillSources(),
    }));
    await waitFor(() => expect(sourcesFetchCount).toBe(1));

    await act(async () => {
      await result.current.backfill.mutateAsync();
    });

    await waitFor(() => expect(sourcesFetchCount).toBe(2));
  });
});
