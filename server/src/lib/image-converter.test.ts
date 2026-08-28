import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock, recordLlmUsageMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  recordLlmUsageMock: vi.fn(),
}));

vi.mock("~/mastra/agents/converter-agent", () => ({
  converterAgent: { generate: generateMock },
}));

vi.mock("~/services/analytics/llm-usage", () => ({
  recordLlmUsage: recordLlmUsageMock,
}));

const { convertToMarkdown, isSupportedMimeType } = await import(
  "./image-converter"
);

beforeEach(() => {
  generateMock.mockReset();
  recordLlmUsageMock.mockReset();
});

describe("isSupportedMimeType", () => {
  it.each([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ])("%s はサポート", (mime) => {
    expect(isSupportedMimeType(mime)).toBe(true);
  });

  it.each(["text/plain", "image/bmp", "application/json", ""])(
    "%s はサポート外",
    (mime) => {
      expect(isSupportedMimeType(mime)).toBe(false);
    },
  );
});

describe("convertToMarkdown", () => {
  it("未サポート mime は例外", async () => {
    await expect(
      convertToMarkdown(new ArrayBuffer(4), "text/plain"),
    ).rejects.toThrow(/Unsupported mime type/);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("converterAgent.generate の text を返す", async () => {
    generateMock.mockResolvedValueOnce({ text: "# converted" });

    const result = await convertToMarkdown(new ArrayBuffer(4), "image/png");

    expect(result).toBe("# converted");
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("converterAgent.generate に base64 と mimeType を渡す", async () => {
    generateMock.mockResolvedValueOnce({ text: "ok" });
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;

    await convertToMarkdown(buf, "image/png");

    const messages = generateMock.mock.calls[0]?.[0] as Array<{
      content: Array<{ type: string; mimeType: string; data: string }>;
    }>;
    expect(messages[0].content[0].mimeType).toBe("image/png");
    expect(messages[0].content[0].type).toBe("file");
    // base64("\xde\xad\xbe\xef") = "3q2+7w==" / Buffer.from のエンコード
    expect(messages[0].content[0].data).toBe("3q2+7w==");
  });

  it("d1 を渡すと実応答モデルと usage を image-convert として記録する", async () => {
    generateMock.mockResolvedValueOnce({
      text: "ok",
      totalUsage: { inputTokens: 100, outputTokens: 10 },
      response: { modelId: "openai/gpt-5.6-terra" },
    });
    const d1 = {} as D1Database;

    await convertToMarkdown(new ArrayBuffer(4), "image/png", d1);

    expect(recordLlmUsageMock).toHaveBeenCalledWith(d1, {
      model: "openai/gpt-5.6-terra",
      usage: { inputTokens: 100, outputTokens: 10 },
      source: "image-convert",
      agent: "converter",
    });
  });

  it("d1 が無ければ記録しない", async () => {
    generateMock.mockResolvedValueOnce({ text: "ok" });

    await convertToMarkdown(new ArrayBuffer(4), "image/png");

    expect(recordLlmUsageMock).not.toHaveBeenCalled();
  });
});
