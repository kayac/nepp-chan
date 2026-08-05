import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Voice } from "~/lib/voice";
import { VoiceCard } from "./VoiceCard";

const personaVoice: Voice = {
  kind: "persona",
  id: "p-1",
  date: "2026-07-28T09:00:00+09:00",
  content: "粗大ごみの出し方がわかりにくい",
  topic: "生活",
  sentiment: "negative",
  attributes: ["40代", "村人"],
};

const emergencyVoice: Voice = {
  kind: "emergency",
  id: "e-1",
  date: "2026-07-28T08:40:00+09:00",
  content: "熊の出没：農道付近で子熊を目撃",
  location: "物満内",
};

describe("VoiceCard", () => {
  it("ペルソナは話題・感情・属性を出す", () => {
    render(<VoiceCard voice={personaVoice} />);

    expect(screen.getByText("生活")).toBeVisible();
    expect(screen.getByText("ネガティブ")).toBeVisible();
    expect(screen.getByText("粗大ごみの出し方がわかりにくい")).toBeVisible();
    expect(screen.getByText("40代")).toBeVisible();
  });

  it("緊急は緊急バッジと場所を出す", () => {
    render(<VoiceCard voice={emergencyVoice} />);

    expect(screen.getByText("緊急")).toBeVisible();
    expect(screen.getByText(/物満内/)).toBeVisible();
    expect(screen.queryByText("ネガティブ")).toBeNull();
  });

  it("感情がなければ感情バッジを出さない", () => {
    render(<VoiceCard voice={{ ...personaVoice, sentiment: null }} />);

    expect(screen.queryByText("ネガティブ")).toBeNull();
    expect(screen.getByText("生活")).toBeVisible();
  });

  it("通常表示は時刻まで出す", () => {
    render(<VoiceCard voice={personaVoice} />);

    expect(screen.getByText(/2026\/07\/28 09:00/)).toBeVisible();
  });

  it("compact は日付を月日だけにし本文を2行に丸める", () => {
    render(<VoiceCard voice={personaVoice} compact />);

    expect(screen.getByText("7月28日")).toBeVisible();
    expect(screen.queryByText(/09:00/)).toBeNull();
    expect(screen.getByText("粗大ごみの出し方がわかりにくい")).toHaveClass(
      "line-clamp-2",
    );
  });
});
