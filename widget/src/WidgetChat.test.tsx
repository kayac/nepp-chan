import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLOSE_MESSAGE_TYPE } from "./messages";
import {
  buildChatStreamResponse,
  buildDeferredChatStreamResponse,
} from "./test/chat-stream";
import { server } from "./test/msw-server";
import { WidgetChat } from "./WidgetChat";

const API_URL = "http://localhost:8787";
const WEB_URL = "http://localhost:5173";

const renderWidgetChat = () =>
  render(<WidgetChat apiUrl={API_URL} webUrl={WEB_URL} />);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WidgetChat", () => {
  it("初回挨拶メッセージを表示する", () => {
    renderWidgetChat();
    expect(screen.getByText(/こんにちは〜！ねっぷちゃんだよ/)).toBeTruthy();
  });

  it("サンプル質問チップを送信すると非表示になる", async () => {
    server.use(
      http.post(`${API_URL}/simple-chat`, () =>
        buildChatStreamResponse("答えだよ"),
      ),
    );
    renderWidgetChat();

    const chip = screen.getByRole("button", { name: "移住の補助金はある？" });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "移住の補助金はある？" }),
      ).toBeNull();
    });
  });

  it("1 往復完了後も入力欄が残り続ける", async () => {
    server.use(
      http.post(`${API_URL}/simple-chat`, () =>
        buildChatStreamResponse("答えだよ"),
      ),
    );
    renderWidgetChat();

    fireEvent.click(
      screen.getByRole("button", { name: "移住の補助金はある？" }),
    );

    await waitFor(() => {
      expect(screen.getByText("答えだよ")).toBeTruthy();
    });

    expect(
      screen.getByPlaceholderText("ねっぷちゃんに話しかける…"),
    ).toBeTruthy();
  });

  it("送信中も入力欄は disabled にせず入力し続けられる", async () => {
    server.use(
      http.post(`${API_URL}/simple-chat`, () =>
        buildChatStreamResponse("答えだよ"),
      ),
    );
    renderWidgetChat();

    const input = screen.getByPlaceholderText(
      "ねっぷちゃんに話しかける…",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "こんにちは" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByLabelText("送信").hasAttribute("disabled")).toBe(true);
    });
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: "追加の入力" } });
    expect(input.value).toBe("追加の入力");

    await waitFor(() => {
      expect(screen.getByText("答えだよ")).toBeTruthy();
    });
  });

  it("送信中に form を再 submit しても POST は 1 回しか飛ばない", async () => {
    let requestCount = 0;
    const deferred = buildDeferredChatStreamResponse();
    server.use(
      http.post(`${API_URL}/simple-chat`, () => {
        requestCount += 1;
        return deferred.response;
      }),
    );
    renderWidgetChat();

    const input = screen.getByPlaceholderText(
      "ねっぷちゃんに話しかける…",
    ) as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;
    fireEvent.change(input, { target: { value: "こんにちは" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByLabelText("送信").hasAttribute("disabled")).toBe(true);
    });

    fireEvent.change(input, { target: { value: "もう一度" } });
    fireEvent.submit(form);

    expect(requestCount).toBe(1);

    deferred.sendStart();
    deferred.sendTextStart();
    deferred.finish("答えだよ");

    await waitFor(() => {
      expect(screen.getByText("答えだよ")).toBeTruthy();
    });

    expect(requestCount).toBe(1);
  });

  it("回答ストリーミングが始まったら待機インジケータを消す", async () => {
    const deferred = buildDeferredChatStreamResponse();
    server.use(http.post(`${API_URL}/simple-chat`, () => deferred.response));
    renderWidgetChat();

    fireEvent.click(
      screen.getByRole("button", { name: "移住の補助金はある？" }),
    );

    await waitFor(() => {
      expect(screen.getByText("ちょっと待ってね…")).toBeTruthy();
    });

    deferred.sendStart();
    deferred.sendTextStart();

    await waitFor(() => {
      expect(screen.queryByText("ちょっと待ってね…")).toBeNull();
    });

    deferred.finish("答えだよ");

    await waitFor(() => {
      expect(screen.getByText("答えだよ")).toBeTruthy();
    });
  });

  it("通信エラー時はエラーバブルを表示する", async () => {
    server.use(
      http.post(
        `${API_URL}/simple-chat`,
        () => new HttpResponse("boom", { status: 500 }),
      ),
    );
    renderWidgetChat();

    fireEvent.click(
      screen.getByRole("button", { name: "音威子府駅ってどんなところ？" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("通信エラーが発生したよ。もう一度試してみてね。"),
      ).toBeTruthy();
    });
  });

  it("閉じるボタンで postMessage を送る", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");
    renderWidgetChat();

    fireEvent.click(screen.getByLabelText("チャットを閉じる"));

    expect(postMessage).toHaveBeenCalledWith({ type: CLOSE_MESSAGE_TYPE }, "*");
  });

  it("Escape キーで postMessage を送る", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");
    renderWidgetChat();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(postMessage).toHaveBeenCalledWith({ type: CLOSE_MESSAGE_TYPE }, "*");
  });

  it("IME 変換中の Escape では postMessage を送らない", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");
    renderWidgetChat();

    fireEvent.keyDown(window, { key: "Escape", isComposing: true });

    expect(postMessage).not.toHaveBeenCalled();
  });
});
