import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useSourceCandidates,
  useUpdateSourceCandidateStatus,
} from "./useSourceCandidates";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useSourceCandidates", () => {
  it("候補一覧を取得する", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ candidates: [{ id: "cand-1" }] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useSourceCandidates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.candidates).toHaveLength(1);
  });
});

describe("useUpdateSourceCandidateStatus", () => {
  it("action を PATCH する", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.patch(
        `${API}/admin/source-candidates/cand-1/status`,
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            message: "ok",
            candidate: { id: "cand-1", status: "approved" },
          });
        },
      ),
    );

    const { result } = renderHookWithQuery(() =>
      useUpdateSourceCandidateStatus(),
    );
    await act(async () => {
      await result.current.mutateAsync({ id: "cand-1", action: "approve" });
    });

    expect(capturedBody).toEqual({ action: "approve" });
  });
});
