import { HttpResponse } from "msw";

const sseLine = (chunk: unknown) => `data: ${JSON.stringify(chunk)}\n\n`;

export const buildChatStreamResponse = (text: string) => {
  const body =
    sseLine({ type: "start" }) +
    sseLine({ type: "start-step" }) +
    sseLine({ type: "text-start", id: "0" }) +
    sseLine({ type: "text-delta", id: "0", delta: text }) +
    sseLine({ type: "text-end", id: "0" }) +
    sseLine({ type: "finish-step" }) +
    sseLine({ type: "finish" }) +
    "data: [DONE]\n\n";

  return HttpResponse.text(body, {
    headers: { "content-type": "text/event-stream" },
  });
};

export const buildDeferredChatStreamResponse = () => {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (chunk: unknown) =>
    controller?.enqueue(encoder.encode(sseLine(chunk)));

  return {
    response: new HttpResponse(stream, {
      headers: { "content-type": "text/event-stream" },
    }),
    sendStart: () => {
      send({ type: "start" });
      send({ type: "start-step" });
    },
    sendTextStart: (id = "0") => send({ type: "text-start", id }),
    sendTextEnd: (id = "0") => {
      send({ type: "text-end", id });
      send({ type: "finish-step" });
    },
    sendToolCallStart: (
      toolCallId = "tool-1",
      toolName = "agent-knowledgeAgent",
    ) => send({ type: "tool-input-start", toolCallId, toolName }),
    finish: (text: string, id = "0") => {
      send({ type: "text-delta", id, delta: text });
      send({ type: "text-end", id });
      send({ type: "finish-step" });
      send({ type: "finish" });
      controller?.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller?.close();
    },
  };
};
