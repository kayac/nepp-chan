import type { messagingApi } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import { type Poll, pollRepository } from "~/repository/poll-repository";
import { buildPanelBubble } from "~/services/line-flex";
import { createLineClient } from "~/services/line-messaging";

export const sendPoll = async (
  env: CloudflareBindings,
  pollId: string,
): Promise<{ success: boolean; error?: string }> => {
  const poll = await pollRepository.findById(env.DB, pollId);
  if (!poll) {
    return { success: false, error: "投票が見つかりません" };
  }
  if (poll.status === "sent") {
    return { success: false, error: "既に配信済みです" };
  }
  if (poll.status === "closed") {
    return { success: false, error: "締切済みの投票は配信できません" };
  }

  try {
    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    const retryKey = crypto.randomUUID();
    const message = buildPollFlexMessage(poll, env.WEB_URL);

    await client.broadcast({ messages: [message] }, retryKey);

    await pollRepository.update(env.DB, pollId, {
      status: "sent",
      sentAt: new Date().toISOString(),
    });

    logger.info(`[Poll] Sent successfully: ${pollId}`);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Poll] Failed to send: ${pollId}`, error);
    return { success: false, error: errorMessage };
  }
};

export const encodePollPostback = (pollId: string, choice: string) =>
  `poll=${pollId}&c=${encodeURIComponent(choice)}`;

export const buildPollFlexMessage = (
  poll: Poll,
  webUrl: string,
): messagingApi.FlexMessage => {
  const choices = JSON.parse(poll.choices) as string[];

  const choiceButtons: messagingApi.FlexComponent[] = choices.map(
    (choice, index) => ({
      type: "button" as const,
      action: {
        type: "postback" as const,
        label: choice.slice(0, 20),
        data: encodePollPostback(poll.id, choice),
        displayText: choice,
      },
      style: index === 0 ? ("primary" as const) : ("secondary" as const),
      height: "md" as const,
      color: index === 0 ? "#5cb7bb" : "#f3eee6",
      adjustMode: "shrink-to-fit" as const,
      scaling: true,
    }),
  );

  const bubble = buildPanelBubble(webUrl, [
    {
      type: "text",
      text: "ねっぷちゃんからの質問だよ！",
      size: "md",
      weight: "bold",
      color: "#0d9296",
      wrap: true,
      scaling: true,
    },
    {
      type: "text",
      text: poll.title,
      margin: "md",
      size: "lg",
      weight: "bold",
      color: "#292524",
      wrap: true,
      lineSpacing: "4px",
      scaling: true,
    },
    {
      type: "separator",
      margin: "xl",
      color: "#cdd0d1",
    },
    {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      margin: "lg",
      contents: choiceButtons,
    },
  ]);

  return {
    type: "flex",
    altText: `投票: ${poll.title}`,
    contents: bubble,
  };
};
