export type LineMessageEvent = {
  type: "message";
  userId: string;
  userMessage: string;
  replyToken: string;
};

export type LineUnfollowEvent = {
  type: "unfollow";
  userId: string;
};

export type LineEventMessage = LineMessageEvent | LineUnfollowEvent;
