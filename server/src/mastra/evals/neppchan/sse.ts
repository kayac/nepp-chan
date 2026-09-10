type StreamEvent = {
  type: string;
  delta?: string;
  toolName?: string;
  errorText?: string;
};

export const parseChatStream = (raw: string) => {
  const parts: string[] = [];
  const tools: string[] = [];
  let current = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;
    const ev = JSON.parse(payload) as StreamEvent;
    if (ev.type === "error")
      throw new Error(`stream error: ${ev.errorText ?? payload}`);
    if (ev.type === "text-delta") current += ev.delta ?? "";
    else if (ev.type === "text-end") {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else if (ev.type === "tool-input-start" && ev.toolName) {
      if (!tools.includes(ev.toolName)) tools.push(ev.toolName);
    }
  }
  if (current.trim()) parts.push(current.trim());
  return { text: parts.join("\n\n"), tools };
};
