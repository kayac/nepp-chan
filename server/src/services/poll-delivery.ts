import type { messagingApi } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import { type Poll, pollRepository } from "~/repository/poll-repository";
import { createLineClient } from "~/services/line-messaging";

// --- LINE配信 ---

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
    const message = buildPollFlexMessage(poll);

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

// --- Postback エンコード ---

export const encodePollPostback = (pollId: string, choice: string) =>
  `poll=${pollId}&c=${encodeURIComponent(choice)}`;

// --- Flex Message 生成 ---

export const buildPollFlexMessage = (poll: Poll): messagingApi.FlexMessage => {
  const choices = JSON.parse(poll.choices) as string[];

  const footerContents: messagingApi.FlexComponent[] = choices.map(
    (choice) => ({
      type: "button" as const,
      action: {
        type: "postback" as const,
        label: choice.slice(0, 20),
        data: encodePollPostback(poll.id, choice),
        displayText: choice,
      },
      style: "primary" as const,
      color: "#4A90D9",
      margin: "sm" as const,
      height: "sm" as const,
    }),
  );

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "ねっぷちゃんからの質問だよ！",
          size: "sm",
          color: "#1DB446",
          weight: "bold",
        },
        {
          type: "text",
          text: poll.title,
          weight: "bold",
          size: "md",
          wrap: true,
          margin: "md",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerContents,
    },
  };

  return {
    type: "flex",
    altText: `投票: ${poll.title}`,
    contents: bubble,
  };
};
