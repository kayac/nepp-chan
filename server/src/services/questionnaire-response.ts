import {
  type QuestionnaireQuestion,
  questionnaireRepository,
} from "~/repository/questionnaire-repository";
import { createLineClient } from "~/services/line-messaging";
import { buildQuestionFlexMessage } from "~/services/questionnaire-delivery";

// --- Postback回答処理 ---

export const handleQuestionnairePostback = async (
  env: CloudflareBindings,
  userId: string,
  data: string,
  replyToken: string,
) => {
  const params = new URLSearchParams(data);
  const questionnaireId = params.get("qnr");
  const questionId = params.get("qid");
  const answer = params.get("ans");

  if (!questionnaireId || !questionId || answer === null) return;

  const questionnaire = await questionnaireRepository.findById(
    env.DB,
    questionnaireId,
  );
  if (!questionnaire || questionnaire.status !== "sent") return;

  const questions =
    await questionnaireRepository.findQuestionsByQuestionnaireId(
      env.DB,
      questionnaireId,
    );
  const question = questions.find((q) => q.id === questionId);
  if (!question) return;

  // 提出を取得 or 作成
  let submission = await questionnaireRepository.findSubmission(
    env.DB,
    questionnaireId,
    userId,
  );

  if (submission?.completedAt) {
    const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "このアンケートには既に回答済みです。ありがとうございます！",
        },
      ],
    });
    return;
  }

  const now = new Date().toISOString();

  if (!submission) {
    submission = {
      id: crypto.randomUUID(),
      questionnaireId,
      userId,
      currentQuestionOrder: question.order,
      completedAt: null,
      createdAt: now,
    };
    await questionnaireRepository.createSubmission(env.DB, {
      id: submission.id,
      questionnaireId,
      userId,
      currentQuestionOrder: question.order,
      createdAt: now,
    });
  }

  // 回答を保存
  const answerData = buildAnswerData(question, answer);
  await questionnaireRepository.createAnswer(env.DB, {
    id: crypto.randomUUID(),
    submissionId: submission.id,
    questionId,
    ...answerData,
    createdAt: now,
  });

  const client = createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN);

  // 次の質問を送信 or 完了
  const nextQuestion = questions.find((q) => q.order === question.order + 1);

  if (nextQuestion) {
    await questionnaireRepository.updateSubmission(env.DB, submission.id, {
      currentQuestionOrder: nextQuestion.order,
    });

    const message = buildQuestionFlexMessage(
      questionnaire,
      nextQuestion,
      nextQuestion.order,
      questions.length,
    );

    try {
      await client.replyMessage({ replyToken, messages: [message] });
    } catch {
      await client.pushMessage({
        to: userId,
        messages: [message],
      });
    }
  } else {
    // 全問回答完了
    await questionnaireRepository.updateSubmission(env.DB, submission.id, {
      completedAt: now,
    });

    try {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text: `「${questionnaire.title}」へのご回答ありがとうございました！`,
          },
        ],
      });
    } catch {
      await client.pushMessage({
        to: userId,
        messages: [
          {
            type: "text",
            text: `「${questionnaire.title}」へのご回答ありがとうございました！`,
          },
        ],
      });
    }
  }
};

const buildAnswerData = (
  question: QuestionnaireQuestion,
  answer: string,
): {
  answerText?: string | null;
  answerNumber?: number | null;
  selectedChoices?: string | null;
} => {
  switch (question.type) {
    case "free_text":
      return { answerText: answer };
    case "rating":
      return { answerNumber: Number.parseInt(answer, 10) };
    case "single_choice":
      return { selectedChoices: JSON.stringify([answer]) };
    case "multiple_choice":
      return { selectedChoices: answer };
    default:
      return { answerText: answer };
  }
};

// --- 集計 ---

export const getQuestionnaireResults = async (
  db: D1Database,
  questionnaireId: string,
) => {
  const questionnaire = await questionnaireRepository.findById(
    db,
    questionnaireId,
  );
  if (!questionnaire) return null;

  const questions =
    await questionnaireRepository.findQuestionsByQuestionnaireId(
      db,
      questionnaireId,
    );
  const submissionCounts = await questionnaireRepository.countSubmissions(
    db,
    questionnaireId,
  );

  const questionResults = await Promise.all(
    questions.map(async (q) => {
      const answers = await questionnaireRepository.findAnswersByQuestionId(
        db,
        q.id,
      );
      return buildQuestionResult(q, answers);
    }),
  );

  return {
    questionnaireId,
    title: questionnaire.title,
    totalSubmissions: submissionCounts.total,
    completedSubmissions: submissionCounts.completed,
    questionResults,
  };
};

const buildQuestionResult = (
  question: QuestionnaireQuestion,
  answers: {
    answerText: string | null;
    answerNumber: number | null;
    selectedChoices: string | null;
  }[],
) => {
  const totalResponses = answers.length;
  const base = {
    questionId: question.id,
    questionText: question.text,
    questionType: question.type,
    totalResponses,
  };

  switch (question.type) {
    case "single_choice":
    case "multiple_choice": {
      const choices = question.choices
        ? (JSON.parse(question.choices) as string[])
        : [];
      const counts: Record<string, number> = {};
      for (const c of choices) counts[c] = 0;

      for (const a of answers) {
        if (!a.selectedChoices) continue;
        const selected = JSON.parse(a.selectedChoices) as string[];
        for (const s of selected) {
          counts[s] = (counts[s] ?? 0) + 1;
        }
      }

      const choiceResults = choices.map((c) => ({
        choice: c,
        count: counts[c] ?? 0,
        percentage:
          totalResponses > 0
            ? Math.round(((counts[c] ?? 0) / totalResponses) * 100)
            : 0,
      }));

      return { ...base, choiceResults };
    }
    case "rating": {
      const ratings = answers
        .map((a) => a.answerNumber)
        .filter((n): n is number => n !== null);
      const avg =
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10,
            ) / 10
          : 0;
      const distribution: Record<string, number> = {};
      for (const r of ratings) {
        const key = String(r);
        distribution[key] = (distribution[key] ?? 0) + 1;
      }
      return { ...base, averageRating: avg, ratingDistribution: distribution };
    }
    case "free_text": {
      const texts = answers
        .map((a) => a.answerText)
        .filter((t): t is string => t !== null);
      return { ...base, freeTextAnswers: texts };
    }
    default:
      return base;
  }
};
