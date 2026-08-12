import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { WidgetSitesPanel } from "./WidgetSitesPanel";

const API = "http://localhost:8787";

const site = {
  id: "ws-1",
  host: "vill.otoineppu.hokkaido.jp",
  instructions: "行政手続きの案内を優先する",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: null,
};

const useSites = (sites = [site]) => {
  server.use(
    http.get(`${API}/admin/widget-sites`, () => HttpResponse.json({ sites })),
  );
};

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

describe("WidgetSitesPanel", () => {
  it("登録済みの設置サイトを一覧表示する", async () => {
    useSites();
    renderWithQuery(<WidgetSitesPanel />);

    expect(
      await screen.findByText("vill.otoineppu.hokkaido.jp"),
    ).toBeInTheDocument();
    expect(screen.getByText("行政手続きの案内を優先する")).toBeInTheDocument();
  });

  it("未登録なら空の案内を出す", async () => {
    useSites([]);
    renderWithQuery(<WidgetSitesPanel />);

    expect(
      await screen.findByText("まだ設置サイトが登録されていません。"),
    ).toBeInTheDocument();
  });

  it("ドメインと指示が埋まるまで追加ボタンを押せない", async () => {
    useSites([]);
    renderWithQuery(<WidgetSitesPanel />);

    const submit = screen.getByRole("button", { name: "追加" });
    expect(submit).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText("www.vill.otoineppu.hokkaido.jp"),
      {
        target: { value: "example.com" },
      },
    );
    expect(submit).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText(
        "行政手続き・窓口案内の質問を優先して受け止める",
      ),
      { target: { value: "案内文" } },
    );
    expect(submit).toBeEnabled();
  });

  it("フォーム送信で設置サイトを登録する", async () => {
    useSites([]);
    let body: unknown;
    server.use(
      http.post(`${API}/admin/widget-sites`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(site, { status: 201 });
      }),
    );
    renderWithQuery(<WidgetSitesPanel />);

    fireEvent.change(
      screen.getByPlaceholderText("www.vill.otoineppu.hokkaido.jp"),
      {
        target: { value: " Example.com " },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        "行政手続き・窓口案内の質問を優先して受け止める",
      ),
      { target: { value: "案内文" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(body).toEqual({ host: "Example.com", instructions: "案内文" });
    });
  });

  it("編集ボタンでフォームに既存の値が入り更新できる", async () => {
    useSites();
    let body: unknown;
    server.use(
      http.put(`${API}/admin/widget-sites/ws-1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(site);
      }),
    );
    renderWithQuery(<WidgetSitesPanel />);

    fireEvent.click(
      await screen.findByLabelText("vill.otoineppu.hokkaido.jp を編集"),
    );

    expect(screen.getByText("設置サイトを編集")).toBeInTheDocument();
    const instructions = screen.getByDisplayValue("行政手続きの案内を優先する");
    fireEvent.change(instructions, { target: { value: "書き換えた案内文" } });
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() => {
      expect(body).toEqual({
        host: "vill.otoineppu.hokkaido.jp",
        instructions: "書き換えた案内文",
      });
    });
  });

  it("キャンセルで編集モードを抜ける", async () => {
    useSites();
    renderWithQuery(<WidgetSitesPanel />);

    fireEvent.click(
      await screen.findByLabelText("vill.otoineppu.hokkaido.jp を編集"),
    );
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.getByText("設置サイトを追加")).toBeInTheDocument();
  });

  it("確認ダイアログを承認したときだけ削除する", async () => {
    useSites();
    let deleted = false;
    server.use(
      http.delete(`${API}/admin/widget-sites/ws-1`, () => {
        deleted = true;
        return HttpResponse.json({ message: "削除しました" });
      }),
    );
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderWithQuery(<WidgetSitesPanel />);

    const deleteButton = await screen.findByLabelText(
      "vill.otoineppu.hokkaido.jp を削除",
    );
    fireEvent.click(deleteButton);
    expect(deleted).toBe(false);

    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(deleted).toBe(true);
    });

    confirmSpy.mockRestore();
  });

  it("登録が失敗したらエラーメッセージを出す", async () => {
    useSites([]);
    server.use(
      http.post(`${API}/admin/widget-sites`, () =>
        HttpResponse.json(
          {
            error: {
              code: 409,
              message: "このドメインはすでに登録されています",
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderWithQuery(<WidgetSitesPanel />);

    fireEvent.change(
      screen.getByPlaceholderText("www.vill.otoineppu.hokkaido.jp"),
      {
        target: { value: "example.com" },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        "行政手続き・窓口案内の質問を優先して受け止める",
      ),
      { target: { value: "案内文" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(
      await screen.findByText("このドメインはすでに登録されています"),
    ).toBeInTheDocument();
  });
});
