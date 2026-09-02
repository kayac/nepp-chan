import type { MastraDBMessage } from "@mastra/core/agent";
import { PIIDetector, type PIIDetectorOptions } from "@mastra/core/processors";
import { OPENAI_LITE, reasoningProviderOptions } from "~/lib/llm-models";

export const piiDetectorConfig = (): PIIDetectorOptions => ({
  model: OPENAI_LITE,
  providerOptions: reasoningProviderOptions("low"),
  detectionTypes: ["name", "address", "phone", "email", "date-of-birth"],
  strategy: "redact",
  redactionMethod: "placeholder",
});

const STRUCTURED_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: "email", pattern: /[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g },
  { type: "phone", pattern: /0\d{1,4}-\d{1,4}-\d{4}/g },
  { type: "phone", pattern: /(?<!\d)0\d{9,10}(?!\d)/g },
  { type: "postal-code", pattern: /〒\s?\d{3}-\d{4}/g },
];

export const redactStructuredPii = (text: string) =>
  STRUCTURED_PATTERNS.reduce(
    (redacted, { type, pattern }) =>
      redacted.replace(pattern, `[${type.toUpperCase()}]`),
    text,
  );

const toMessage = (text: string, id: string): MastraDBMessage => ({
  id,
  role: "user",
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: "text", text }] },
});

const textOf = (message: MastraDBMessage) =>
  message.content.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");

export const redactPii = async (texts: string[]) => {
  const targets = texts
    .map((text, index) => ({ text, id: String(index) }))
    .filter(({ text }) => text.trim().length > 0);
  if (targets.length === 0) return texts;

  const detector = new PIIDetector(piiDetectorConfig());
  const processed = await detector.processInput({
    messages: targets.map(({ text, id }) => toMessage(text, id)),
    abort: (reason) => {
      throw new Error(reason ?? "PII redaction aborted");
    },
  });

  const redactedById = new Map(
    processed.map((message) => [message.id, textOf(message)]),
  );
  return texts.map((text, index) => {
    if (text.trim().length === 0) return text;
    const redacted = redactedById.get(String(index));
    return redacted === undefined ? "" : redactStructuredPii(redacted);
  });
};
