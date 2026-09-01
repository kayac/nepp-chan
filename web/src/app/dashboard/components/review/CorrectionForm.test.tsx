import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { CorrectionForm } from "./CorrectionForm";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("CorrectionForm", () => {
  it("本文が空のうちは発行できない", () => {
    renderWithQuery(
      <CorrectionForm answerRunId="ar-1" sourceOptions={["bus/index.md"]} />,
    );

    expect(
      screen.getByRole("button", { name: "訂正を発行する" }),
    ).toBeDisabled();
  });

  it("対象と本文を指定して発行し、完了メッセージを表示する", async () => {
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

    renderWithQuery(
      <CorrectionForm
        answerRunId="ar-1"
        sourceOptions={["bus/index.md", "garbage.md"]}
      />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "garbage.md");
    await userEvent.type(
      screen.getByPlaceholderText(/正しい内容/),
      "土曜は運休です",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "訂正を発行する" }),
    );

    expect(await screen.findByText(/訂正を発行しました/)).toBeInTheDocument();
    expect(capturedBody).toEqual({
      correctsSourcePath: "garbage.md",
      body: "土曜は運休です",
      answerRunId: "ar-1",
    });
  });

  it("発行に失敗したらエラーを表示する", async () => {
    server.use(
      http.post(`${API}/admin/corrections`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "発行に失敗しました" } },
          { status: 500 },
        ),
      ),
    );

    renderWithQuery(
      <CorrectionForm answerRunId="ar-1" sourceOptions={["bus/index.md"]} />,
    );

    await userEvent.type(
      screen.getByPlaceholderText(/正しい内容/),
      "土曜は運休です",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "訂正を発行する" }),
    );

    expect(await screen.findByText(/^エラー:/)).toBeInTheDocument();
  });
});
