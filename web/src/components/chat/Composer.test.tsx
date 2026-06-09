import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChatContext,
  type ChatContextValue,
} from "~/app/chat/contexts/ChatContext";

import { Composer } from "./Composer";

const renderComposer = (overrides: Partial<ChatContextValue> = {}) => {
  const value: ChatContextValue = {
    threadId: "t-1",
    messages: [],
    status: "ready",
    error: undefined,
    isRunning: false,
    sendMessage: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
  render(
    <ChatContext.Provider value={value}>
      <Composer />
    </ChatContext.Provider>,
  );
  return value;
};

describe("Composer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Enter で送信し、入力をクリアする", async () => {
    const sendMessage = vi.fn();
    renderComposer({ sendMessage });
    const textarea = screen.getByLabelText("メッセージ入力");

    await userEvent.type(textarea, "こんにちは");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(sendMessage).toHaveBeenCalledWith({ text: "こんにちは" });
    expect(textarea).toHaveValue("");
  });

  it("Shift+Enter では送信しない", async () => {
    const sendMessage = vi.fn();
    renderComposer({ sendMessage });
    const textarea = screen.getByLabelText("メッセージ入力");

    await userEvent.type(textarea, "改行したい");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("IME 変換確定中（keyCode 229）の Enter では送信しない", async () => {
    const sendMessage = vi.fn();
    renderComposer({ sendMessage });
    const textarea = screen.getByLabelText("メッセージ入力");

    await userEvent.type(textarea, "へんかん");
    fireEvent.keyDown(textarea, { key: "Enter", keyCode: 229 });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("タッチデバイスでは Enter で送信しない", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const sendMessage = vi.fn();
    renderComposer({ sendMessage });
    const textarea = screen.getByLabelText("メッセージ入力");

    await userEvent.type(textarea, "モバイル");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("送信ボタンで送信できる", async () => {
    const sendMessage = vi.fn();
    renderComposer({ sendMessage });

    await userEvent.type(screen.getByLabelText("メッセージ入力"), "ボタン送信");
    await userEvent.click(screen.getByLabelText("送信"));

    expect(sendMessage).toHaveBeenCalledWith({ text: "ボタン送信" });
  });

  it("空入力では送信ボタンが無効", () => {
    renderComposer();
    expect(screen.getByLabelText("送信")).toBeDisabled();
  });

  it("実行中は停止ボタンを表示し、送信ボタンを出さない", () => {
    renderComposer({ isRunning: true });
    expect(screen.getByLabelText("停止")).toBeInTheDocument();
    expect(screen.queryByLabelText("送信")).not.toBeInTheDocument();
  });
});
