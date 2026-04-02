import type { messagingApi } from "@line/bot-sdk";

import { logger } from "~/lib/logger";
import {
  type Questionnaire,
  type QuestionnaireQuestion,
  questionnaireRepository,
} from "~/repository/questionnaire-repository";
import { createLineClient } from "~/services/line-messaging";

// --- LINE配信 ---

export const sendQuestionnaire = async (
  env: CloudflareBindings,
  questionnaireId: string,
): Promise<{ success: boolean; error?: string }> => {
  const questionnaire = await questionnaireRepository.findById(
    env.DB,
    questionnaireId,
  );
  if (!questionnaire) {
    return { success: false, error: "アンケートが見つかりません" };
  }
  if (questionnaire.status === "sent") {
    return { success: false, error: "既に配信済みです" };
  }
  if (questionnaire.status === "closed") {
    return { success: false, error: "締切済みのアンケートは配信できません" };
  }

  const questions =
    await questionnaireRepository.findQuestionsByQuestionnaireId(
      env.DB,
      questionnaireId,
    );
  if (questions.length === 0) {
    return { success: false, error: "設問がありません" };
  }

  try {
    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    const retryKey = crypto.randomUUID();
    const firstQuestion = questions[0];
    const message = buildQuestionFlexMessage(
      questionnaire,
      firstQuestion,
      1,
      questions.length,
    );

    await client.broadcast({ messages: [message] }, retryKey);

    await questionnaireRepository.update(env.DB, questionnaireId, {
      status: "sent",
      sentAt: new Date().toISOString(),
    });

    logger.info(`[Questionnaire] Sent successfully: ${questionnaireId}`);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Questionnaire] Failed to send: ${questionnaireId}`, error);
    return { success: false, error: errorMessage };
  }
};

// --- Flex Message生成 ---

export const buildQuestionFlexMessage = (
  questionnaire: Questionnaire,
  question: QuestionnaireQuestion,
  currentOrder: number,
  totalQuestions: number,
): messagingApi.FlexMessage => {
  const choices = question.choices
    ? (JSON.parse(question.choices) as string[])
    : [];

  const bodyContents: messagingApi.FlexComponent[] = [
    {
      type: "text",
      text: questionnaire.title,
      weight: "bold",
      size: "sm",
      color: "#1DB446",
    },
    {
      type: "text",
      text: `Q${currentOrder}/${totalQuestions}`,
      size: "xs",
      color: "#aaaaaa",
      margin: "md",
    },
    {
      type: "text",
      text: question.text,
      weight: "bold",
      size: "md",
      wrap: true,
      margin: "md",
    },
  ];

  let footerContents: messagingApi.FlexComponent[];

  switch (question.type) {
    case "single_choice":
    case "multiple_choice":
      footerContents = choices.map((choice) => ({
        type: "button" as const,
        action: {
          type: "postback" as const,
          label: choice.slice(0, 20),
          data: `qnr=${questionnaire.id}&qid=${question.id}&ans=${encodeURIComponent(choice)}`,
          displayText: choice,
        },
        style: "primary" as const,
        color: "#4A90D9",
        margin: "sm" as const,
        height: "sm" as const,
      }));
      break;
    case "rating":
      footerContents = [
        {
          type: "box" as const,
          layout: "horizontal" as const,
          spacing: "sm" as const,
          contents: [1, 2, 3, 4, 5].map((n) => ({
            type: "button" as const,
            action: {
              type: "postback" as const,
              label: String(n),
              data: `qnr=${questionnaire.id}&qid=${question.id}&ans=${n}`,
              displayText: `${n}`,
            },
            style: "primary" as const,
            color: "#4A90D9",
            height: "sm" as const,
            flex: 1,
          })),
        },
        {
          type: "box" as const,
          layout: "horizontal" as const,
          margin: "xs" as const,
          contents: [
            {
              type: "text" as const,
              text: "低い",
              size: "xxs" as const,
              color: "#aaaaaa",
              align: "start" as const,
            },
            {
              type: "text" as const,
              text: "高い",
              size: "xxs" as const,
              color: "#aaaaaa",
              align: "end" as const,
            },
          ],
        },
      ];
      break;
    case "free_text":
      bodyContents.push({
        type: "text",
        text: "テキストで回答を入力してください",
        size: "xs",
        color: "#888888",
        margin: "md",
        wrap: true,
      });
      footerContents = [];
      break;
    default:
      footerContents = [];
  }

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
    ...(footerContents.length > 0 && {
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerContents,
      },
    }),
  };

  return {
    type: "flex",
    altText: `アンケート: ${questionnaire.title} (Q${currentOrder}/${totalQuestions})`,
    contents: bubble,
  };
};
