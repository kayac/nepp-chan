import type { messagingApi } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import { toLineIds } from "~/lib/principal";
import { type Poll, pollRepository } from "~/repository/poll-repository";
import { createLineClient, generateReply } from "~/services/line-messaging";

// --- Postback デコード ---

const decodePollPostback = (data: string) => {
  const params = new URLSearchParams(data);
  return {
    pollId: params.get("poll"),
    selectedChoice: params.get("c"),
  };
};

// --- Postback 回答処理 ---

export type PollAnswerResult =
  | { status: "answered"; poll: Poll; selectedChoice: string }
  | { status: "already"; poll: Poll }
  | { status: "invalid" };

export const handlePollPostback = async (
  env: CloudflareBindings,
  userId: string,
  data: string,
  replyToken: string,
): Promise<PollAnswerResult> => {
  const { pollId, selectedChoice } = decodePollPostback(data);
  if (!pollId || !selectedChoice) return { status: "invalid" };

  const principal = { type: "line", id: userId } as const;
  const { hashedUserId } = await toLineIds(
    principal,
    env.RESOURCE_ID_HASH_SECRET,
  );

  const [poll, existing] = await Promise.all([
    pollRepository.findById(env.DB, pollId),
    pollRepository.findSubmission(env.DB, pollId, hashedUserId),
  ]);

  if (!poll) return { status: "invalid" };
  if (poll.status !== "sent" && poll.status !== "closed") {
    return { status: "invalid" };
  }

  const choices = JSON.parse(poll.choices) as string[];
  if (!choices.includes(selectedChoice)) return { status: "invalid" };

  const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);

  if (existing) {
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: `この投票には「${existing.selectedChoice}」で回答済みだよ。`,
        },
      ],
    });
    return { status: "already", poll };
  }

  const now = new Date().toISOString();
  await pollRepository.createSubmission(env.DB, {
    id: crypto.randomUUID(),
    pollId,
    userId: hashedUserId,
    selectedChoice,
    createdAt: now,
  });

  const completionMessage = buildCompletionFlexMessage(
    poll,
    selectedChoice,
    env.WEB_URL,
  );

  await client.replyMessage({
    replyToken,
    messages: [completionMessage],
  });

  return { status: "answered", poll, selectedChoice };
};

const buildCompletionFlexMessage = (
  poll: Poll,
  selectedChoice: string,
  webUrl: string,
): messagingApi.FlexMessage => {
  const pollUrl = `${webUrl}/poll?id=${poll.id}`;

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `「${selectedChoice}」に投票しました`,
          size: "sm",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "結果を見る",
            uri: pollUrl,
          },
          style: "primary",
          color: "#0f7177",
          height: "sm",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `「${selectedChoice}」に投票しました`,
    contents: bubble,
  };
};

// --- 回答後のねっぷちゃんからのフォローアップ会話 ---

export const generatePollFollowUp = async (
  env: CloudflareBindings,
  userId: string,
  poll: Poll,
  selectedChoice: string,
) => {
  try {
    const principal = { type: "line", id: userId } as const;
    const { hashedUserId, resourceId, threadId } = await toLineIds(
      principal,
      env.RESOURCE_ID_HASH_SECRET,
    );

    const userMessage = `（投票）「${poll.title}」で「${selectedChoice}」を選んだよ。`;

    const replyTexts = await generateReply({
      userMessage,
      userId,
      hashedUserId,
      resourceId,
      threadId,
      env,
    });

    if (replyTexts.length === 0) return;

    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    await client.pushMessage({
      to: userId,
      messages: replyTexts.map((text) => ({ type: "text" as const, text })),
    });
  } catch (error) {
    logger.error("[Poll] Follow-up push failed", error);
  }
};

// --- 集計 ---

export const getPollResults = async (db: D1Database, pollId: string) => {
  const poll = await pollRepository.findById(db, pollId);
  if (!poll) return null;

  const submissions = await pollRepository.findSubmissionsByPoll(db, pollId);
  const choices = JSON.parse(poll.choices) as string[];

  const counts: Record<string, number> = {};
  for (const c of choices) counts[c] = 0;
  for (const s of submissions) {
    if (s.selectedChoice in counts) {
      counts[s.selectedChoice] = (counts[s.selectedChoice] ?? 0) + 1;
    }
  }

  const total = submissions.length;
  const choiceResults = choices.map((choice) => ({
    choice,
    count: counts[choice] ?? 0,
    percentage:
      total > 0 ? Math.round(((counts[choice] ?? 0) / total) * 100) : 0,
  }));

  return {
    pollId,
    title: poll.title,
    totalSubmissions: total,
    choiceResults,
  };
};
