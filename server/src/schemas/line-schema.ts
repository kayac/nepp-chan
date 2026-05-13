import type { MessageEvent, UnfollowEvent } from "@line/bot-sdk";

export type LineMessageEvent = {
  type: MessageEvent["type"];
  userId: string;
  userMessage: string;
  replyToken: string;
};

export type LineUnfollowEvent = {
  type: UnfollowEvent["type"];
  userId: string;
};

export type LineEventMessage = LineMessageEvent | LineUnfollowEvent;
