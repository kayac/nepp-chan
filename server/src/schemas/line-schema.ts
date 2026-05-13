import type { webhook } from "@line/bot-sdk";

export type LineMessageEvent = {
  type: webhook.MessageEvent["type"];
  userId: string;
  userMessage: string;
  replyToken: string;
};

export type LineUnfollowEvent = {
  type: webhook.UnfollowEvent["type"];
  userId: string;
};

export type LineEventMessage = LineMessageEvent | LineUnfollowEvent;
