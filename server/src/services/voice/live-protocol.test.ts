import { describe, expect, it } from "vitest";
import {
  commentaryAppendMessage,
  inputAudioAppendMessage,
  instructionsAppendMessage,
  parseLiveEvent,
  parseStreamEvent,
  serializeLiveMessage,
  serializeStreamMessage,
  sessionCloseMessage,
  sessionStartMessage,
  streamMediaMessage,
} from "./live-protocol";

describe("parseStreamEvent", () => {
  it("start から streamSid と customParameters を取り出す", () => {
    const raw = JSON.stringify({
      event: "start",
      sequenceNumber: "2",
      streamSid: "MZ123",
      start: {
        streamSid: "MZ123",
        accountSid: "AC123",
        callSid: "CA123",
        tracks: ["inbound"],
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000 },
        customParameters: { token: "abc" },
      },
    });
    const event = parseStreamEvent(raw);
    if (event?.event !== "start") throw new Error("expected start");
    expect(event.streamSid).toBe("MZ123");
    expect(event.start.callSid).toBe("CA123");
    expect(event.start.customParameters).toEqual({ token: "abc" });
  });

  it("customParameters を伴わない start も受け入れる", () => {
    const event = parseStreamEvent(
      JSON.stringify({
        event: "start",
        streamSid: "MZ123",
        start: { streamSid: "MZ123", callSid: "CA123" },
      }),
    );
    if (event?.event !== "start") throw new Error("expected start");
    expect(event.start.customParameters).toBeUndefined();
  });

  it("media の base64 payload を取り出す", () => {
    const event = parseStreamEvent(
      JSON.stringify({
        event: "media",
        sequenceNumber: "3",
        streamSid: "MZ123",
        media: {
          track: "inbound",
          chunk: "1",
          timestamp: "20",
          payload: "//7//f8=",
        },
      }),
    );
    if (event?.event !== "media") throw new Error("expected media");
    expect(event.media.payload).toBe("//7//f8=");
    expect(event.media.track).toBe("inbound");
  });

  it("connected / stop も既知のイベントとして解釈する", () => {
    expect(
      parseStreamEvent(JSON.stringify({ event: "connected", protocol: "Call" }))
        ?.event,
    ).toBe("connected");
    expect(
      parseStreamEvent(JSON.stringify({ event: "stop", streamSid: "MZ123" }))
        ?.event,
    ).toBe("stop");
  });

  it("未使用のイベント（mark / dtmf）は null を返す", () => {
    expect(
      parseStreamEvent(JSON.stringify({ event: "mark", streamSid: "MZ1" })),
    ).toBeNull();
    expect(
      parseStreamEvent(JSON.stringify({ event: "dtmf", streamSid: "MZ1" })),
    ).toBeNull();
  });

  it("不正な JSON と必須フィールド欠落は null を返す", () => {
    expect(parseStreamEvent("not json")).toBeNull();
    expect(
      parseStreamEvent(JSON.stringify({ event: "media", streamSid: "MZ1" })),
    ).toBeNull();
  });
});

describe("streamMediaMessage", () => {
  it("media は streamSid を伴う Twilio 形式で作る", () => {
    expect(streamMediaMessage("MZ123", "//7//f8=")).toEqual({
      event: "media",
      streamSid: "MZ123",
      media: { payload: "//7//f8=" },
    });
  });

  it("JSON 文字列化して往復できる", () => {
    const msg = streamMediaMessage("MZ123", "AAA=");
    expect(JSON.parse(serializeStreamMessage(msg))).toEqual(msg);
  });
});

describe("parseLiveEvent", () => {
  it("session.started を解釈する", () => {
    expect(
      parseLiveEvent(
        JSON.stringify({ type: "session.started", session: { id: "sess_1" } }),
      )?.type,
    ).toBe("session.started");
  });

  it("output_audio.delta の base64 を取り出す", () => {
    const event = parseLiveEvent(
      JSON.stringify({
        type: "session.output_audio.delta",
        event_id: "e1",
        delta: "//7//f8=",
      }),
    );
    if (event?.type !== "session.output_audio.delta") {
      throw new Error("expected output_audio.delta");
    }
    expect(event.delta).toBe("//7//f8=");
  });

  it("input_transcript.delta の文字列と時刻を取り出す", () => {
    const event = parseLiveEvent(
      JSON.stringify({
        type: "session.input_transcript.delta",
        delta: "音威子府そばって",
        start_ms: 1200,
        end_ms: 1800,
      }),
    );
    if (event?.type !== "session.input_transcript.delta") {
      throw new Error("expected input_transcript.delta");
    }
    expect(event.delta).toBe("音威子府そばって");
    expect(event.start_ms).toBe(1200);
    expect(event.end_ms).toBe(1800);
  });

  it("output_transcript.delta も同じ形で解釈する", () => {
    expect(
      parseLiveEvent(
        JSON.stringify({
          type: "session.output_transcript.delta",
          delta: "そうだよー",
        }),
      )?.type,
    ).toBe("session.output_transcript.delta");
  });

  it("delegation.created から id と offset_ms を取り出す", () => {
    const event = parseLiveEvent(
      JSON.stringify({
        type: "session.delegation.created",
        event_id: "event_delegation",
        offset_ms: 1000,
        delegation: {
          id: "item_9tA2bF3h7K9m2P5q8R1s4",
          type: "delegation",
          target: "client",
        },
      }),
    );
    if (event?.type !== "session.delegation.created") {
      throw new Error("expected delegation.created");
    }
    expect(event.delegation.id).toBe("item_9tA2bF3h7K9m2P5q8R1s4");
    expect(event.delegation.target).toBe("client");
    expect(event.offset_ms).toBe(1000);
  });

  it("session.closed の usage を未加工のまま保持する", () => {
    const event = parseLiveEvent(
      JSON.stringify({
        type: "session.closed",
        usage: { audio_seconds: 42 },
      }),
    );
    if (event?.type !== "session.closed") throw new Error("expected closed");
    expect(event.usage).toEqual({ audio_seconds: 42 });
  });

  it("error を既知の型として解釈する（session.start 拒否の診断経路）", () => {
    expect(
      parseLiveEvent(
        JSON.stringify({
          type: "error",
          error: { message: "unknown field: foo" },
        }),
      )?.type,
    ).toBe("error");
  });

  it("未知の type と不正な JSON は null を返す", () => {
    expect(
      parseLiveEvent(JSON.stringify({ type: "session.future" })),
    ).toBeNull();
    expect(parseLiveEvent("not json")).toBeNull();
  });

  it("delta 欠落は null を返す", () => {
    expect(
      parseLiveEvent(JSON.stringify({ type: "session.output_audio.delta" })),
    ).toBeNull();
  });
});

describe("sessionStartMessage", () => {
  it("Twilio Media Streams と一致する μ-law 8kHz を指定する", () => {
    const msg = sessionStartMessage({
      eventId: "start_1",
      model: "gpt-live-1",
      instructions: "ねっぷちゃんとして話す",
      voice: "marin",
    });
    expect(msg.session.audio.format).toEqual({
      type: "audio/pcmu",
      rate: 8000,
    });
    expect(msg.session.audio.output.voice).toBe("marin");
    expect(msg.session.model).toBe("gpt-live-1");
    expect(msg.session.instructions).toBe("ねっぷちゃんとして話す");
  });

  it("delegation は client を明示する", () => {
    const msg = sessionStartMessage({
      eventId: "start_1",
      model: "gpt-live-1",
      instructions: "x",
      voice: "marin",
    });
    expect(msg.session.delegation).toEqual({ type: "client" });
  });

  it("session は未知フィールドを拒否するため既定のキーだけを持つ", () => {
    const msg = sessionStartMessage({
      eventId: "start_1",
      model: "gpt-live-1",
      instructions: "x",
      voice: "marin",
    });
    expect(Object.keys(msg.session)).toEqual([
      "model",
      "instructions",
      "audio",
      "delegation",
    ]);
  });
});

describe("送信メッセージ", () => {
  it("input_audio.append は base64 を audio キーで送る", () => {
    expect(inputAudioAppendMessage("//7//f8=")).toEqual({
      type: "session.input_audio.append",
      audio: "//7//f8=",
    });
  });

  it("commentary.append は event_id と delegation_id を伴う", () => {
    expect(
      commentaryAppendMessage("c_1", "音威子府そばは黒い麺だよ", "item_1"),
    ).toEqual({
      type: "session.commentary.append",
      event_id: "c_1",
      delegation_id: "item_1",
      content: "音威子府そばは黒い麺だよ",
    });
  });

  it("delegation_id は省略すると null になる（必須で null 許容）", () => {
    expect(instructionsAppendMessage("g_1", "今すぐ挨拶して")).toEqual({
      type: "session.instructions.append",
      event_id: "g_1",
      delegation_id: null,
      content: "今すぐ挨拶して",
    });
    expect(commentaryAppendMessage("c_1", "始めて").delegation_id).toBeNull();
  });

  it("session.close は event_id を伴う", () => {
    expect(sessionCloseMessage("close_1")).toEqual({
      type: "session.close",
      event_id: "close_1",
    });
  });

  it("JSON 文字列化して往復できる", () => {
    const msg = inputAudioAppendMessage("AAA=");
    expect(JSON.parse(serializeLiveMessage(msg))).toEqual(msg);
  });
});
