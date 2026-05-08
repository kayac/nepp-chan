import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../../../lib/auth-token";
import { server } from "../../../test/msw-server";
import { renderWithQuery } from "../../../test/query";
import { EmergencyPanel } from "./EmergencyPanel";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("EmergencyPanel", () => {
  it("空のときは『緊急情報がありません』を表示", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, () =>
        HttpResponse.json({ emergencies: [] }),
      ),
    );

    renderWithQuery(<EmergencyPanel />);

    expect(screen.getByText("読み込み中...")).toBeDefined();
    await waitFor(() =>
      expect(screen.getByText("緊急情報がありません")).toBeDefined(),
    );
  });

  it("データありなら type / description / location を表示", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, () =>
        HttpResponse.json({
          emergencies: [
            {
              id: "e-1",
              type: "雪崩",
              description: "国道で発生",
              location: "音威子府",
              reportedAt: "2025-01-01T00:00:00Z",
              updatedAt: null,
            },
            {
              id: "e-2",
              type: "停電",
              description: "村落部",
              location: null,
              reportedAt: "2025-01-02T00:00:00Z",
              updatedAt: null,
            },
          ],
        }),
      ),
    );

    renderWithQuery(<EmergencyPanel />);

    await waitFor(() => {
      expect(screen.getAllByText("雪崩").length).toBeGreaterThan(0);
      expect(screen.getAllByText("国道で発生").length).toBeGreaterThan(0);
      expect(screen.getAllByText("音威子府").length).toBeGreaterThan(0);
      expect(screen.getAllByText("停電").length).toBeGreaterThan(0);
    });
  });

  it("API エラーなら『エラー: ...』を表示", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    renderWithQuery(<EmergencyPanel />);

    await waitFor(() => {
      const errorEl = screen.getByText(/エラー:/);
      expect(errorEl).toBeDefined();
    });
  });
});
