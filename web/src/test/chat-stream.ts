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
