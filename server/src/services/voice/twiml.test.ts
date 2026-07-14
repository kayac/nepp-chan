import { describe, expect, it } from "vitest";
import { buildConversationRelayTwiml } from "./twiml";

describe("buildConversationRelayTwiml", () => {
  it("Connect > ConversationRelay を含む TwiML を返す", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://api.example.com/twilio/voice/relay",
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<Response><Connect><ConversationRelay");
    expect(xml).toContain("</Connect></Response>");
  });

  it("language は既定で ja-JP", () => {
    const xml = buildConversationRelayTwiml({ wsUrl: "wss://x/relay" });
    expect(xml).toContain('language="ja-JP"');
  });

  it("url のクエリ文字列の & を XML エスケープする", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://api.example.com/twilio/voice/relay?token=abc&call=CA1",
    });
    expect(xml).toContain(
      'url="wss://api.example.com/twilio/voice/relay?token=abc&amp;call=CA1"',
    );
    expect(xml).not.toContain("call=CA1&");
  });

  it("ttsProvider / voice を env 由来で注入できる（疎結合）", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      ttsProvider: "Google",
      voice: "ja-JP-Neural2-B",
    });
    expect(xml).toContain('ttsProvider="Google"');
    expect(xml).toContain('voice="ja-JP-Neural2-B"');
  });

  it("未指定の任意属性は出力しない", () => {
    const xml = buildConversationRelayTwiml({ wsUrl: "wss://x/relay" });
    expect(xml).not.toContain("ttsProvider");
    expect(xml).not.toContain("voice=");
    expect(xml).not.toContain("welcomeGreeting");
  });

  it("welcomeGreeting の特殊文字をエスケープする", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      welcomeGreeting: 'こんにちは"ねっぷちゃん"だよ & よろしく',
    });
    expect(xml).toContain(
      'welcomeGreeting="こんにちは&quot;ねっぷちゃん&quot;だよ &amp; よろしく"',
    );
  });

  it("interruptible と transcriptionProvider を含められる", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      interruptible: "speech",
      transcriptionProvider: "Google",
    });
    expect(xml).toContain('interruptible="speech"');
    expect(xml).toContain('transcriptionProvider="Google"');
  });

  it("speechModel / speechTimeout を含められる", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      speechModel: "telephony",
      speechTimeout: "700",
    });
    expect(xml).toContain('speechModel="telephony"');
    expect(xml).toContain('speechTimeout="700"');
  });

  it("hints を含められる（固有名詞の認識ブースト）", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      hints: "音威子府,おといねっぷ",
    });
    expect(xml).toContain('hints="音威子府,おといねっぷ"');
  });

  it("未指定なら endpointing 系の任意属性は出力しない", () => {
    const xml = buildConversationRelayTwiml({ wsUrl: "wss://x/relay" });
    expect(xml).not.toContain("speechModel");
    expect(xml).not.toContain("speechTimeout");
    expect(xml).not.toContain("hints");
  });

  it("割り込み・入力検知系の属性を含められる", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      welcomeGreetingInterruptible: "none",
      interruptSensitivity: "low",
      reportInputDuringAgentSpeech: "dtmf",
    });
    expect(xml).toContain('welcomeGreetingInterruptible="none"');
    expect(xml).toContain('interruptSensitivity="low"');
    expect(xml).toContain('reportInputDuringAgentSpeech="dtmf"');
  });

  it("言語オーバーライドと Deepgram/ElevenLabs 固有属性を含められる", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      ttsLanguage: "ja-JP",
      transcriptionLanguage: "en-US",
      eotThreshold: "0.7",
      elevenlabsTextNormalization: "auto",
      debug: "debugging",
    });
    expect(xml).toContain('ttsLanguage="ja-JP"');
    expect(xml).toContain('transcriptionLanguage="en-US"');
    expect(xml).toContain('eotThreshold="0.7"');
    expect(xml).toContain('elevenlabsTextNormalization="auto"');
    expect(xml).toContain('debug="debugging"');
  });

  it("bool 属性は true/false を明示出力し、未指定なら出力しない", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      partialPrompts: false,
      deepgramSmartFormat: false,
      dtmfDetection: true,
      ignoreBackchannel: true,
      preemptible: false,
    });
    expect(xml).toContain('partialPrompts="false"');
    expect(xml).toContain('deepgramSmartFormat="false"');
    expect(xml).toContain('dtmfDetection="true"');
    expect(xml).toContain('ignoreBackchannel="true"');
    expect(xml).toContain('preemptible="false"');

    const bare = buildConversationRelayTwiml({ wsUrl: "wss://x/relay" });
    expect(bare).not.toContain("partialPrompts");
    expect(bare).not.toContain("deepgramSmartFormat");
    expect(bare).not.toContain("dtmfDetection");
  });

  it("parameters を指定すると <Parameter> 子要素として出力する", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      parameters: { token: "abc123" },
    });
    expect(xml).toContain(
      '<ConversationRelay url="wss://x/relay" language="ja-JP"><Parameter name="token" value="abc123"/></ConversationRelay>',
    );
  });

  it("parameters の値の特殊文字を XML エスケープする", () => {
    const xml = buildConversationRelayTwiml({
      wsUrl: "wss://x/relay",
      parameters: { token: 'a"b&c' },
    });
    expect(xml).toContain('value="a&quot;b&amp;c"');
  });

  it("parameters 未指定なら ConversationRelay は自己終了タグのまま", () => {
    const xml = buildConversationRelayTwiml({ wsUrl: "wss://x/relay" });
    expect(xml).toContain("<ConversationRelay");
    expect(xml).toContain("/></Connect></Response>");
    expect(xml).not.toContain("<Parameter");
  });
});
