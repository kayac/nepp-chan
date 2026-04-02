import {
  type Questionnaire,
  type QuestionnaireQuestion,
  questionnaireRepository,
} from "~/repository/questionnaire-repository";
import type { QuestionInput } from "~/schemas/questionnaire-schema";
import { sendQuestionnaire } from "~/services/questionnaire-delivery";

// --- アンケート作成 ---

type CreateInput = {
  title: string;
  description?: string;
  isAnonymous?: boolean;
  questions: QuestionInput[];
  scheduledAt?: string;
  sendNow?: boolean;
  createdBy: string;
};

export const createQuestionnaire = async (
  env: CloudflareBindings,
  input: CreateInput,
) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = input.sendNow
    ? "draft"
    : input.scheduledAt
      ? "scheduled"
      : "draft";

  await questionnaireRepository.create(env.DB, {
    id,
    title: input.title,
    description: input.description,
    isAnonymous: input.isAnonymous === false ? 0 : 1,
    status,
    createdBy: input.createdBy,
    createdAt: now,
  });

  if (input.scheduledAt) {
    await questionnaireRepository.update(env.DB, id, {
      scheduledAt: input.scheduledAt,
    });
  }

  const questionInputs = input.questions.map((q, i) => ({
    id: crypto.randomUUID(),
    questionnaireId: id,
    order: i + 1,
    text: q.text,
    type: q.type,
    required: q.required === false ? 0 : 1,
    choices: q.choices ? JSON.stringify(q.choices) : null,
    createdAt: now,
  }));

  await questionnaireRepository.createQuestions(env.DB, questionInputs);

  if (input.sendNow) {
    const result = await sendQuestionnaire(env, id);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  return getQuestionnaireWithQuestions(env.DB, id);
};

// --- アンケート更新 ---

type UpdateInput = {
  title?: string;
  description?: string | null;
  isAnonymous?: boolean;
  questions?: QuestionInput[];
};

export const updateQuestionnaire = async (
  db: D1Database,
  id: string,
  input: UpdateInput,
) => {
  const updateData: Parameters<typeof questionnaireRepository.update>[2] = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.isAnonymous !== undefined)
    updateData.isAnonymous = input.isAnonymous ? 1 : 0;

  if (Object.keys(updateData).length > 0) {
    await questionnaireRepository.update(db, id, updateData);
  }

  if (input.questions) {
    const now = new Date().toISOString();
    await questionnaireRepository.deleteQuestionsByQuestionnaireId(db, id);
    const questionInputs = input.questions.map((q, i) => ({
      id: crypto.randomUUID(),
      questionnaireId: id,
      order: i + 1,
      text: q.text,
      type: q.type,
      required: q.required === false ? 0 : 1,
      choices: q.choices ? JSON.stringify(q.choices) : null,
      createdAt: now,
    }));
    await questionnaireRepository.createQuestions(db, questionInputs);
  }

  return getQuestionnaireWithQuestions(db, id);
};

// --- アンケート詳細取得 ---

export const getQuestionnaireWithQuestions = async (
  db: D1Database,
  id: string,
) => {
  const questionnaire = await questionnaireRepository.findById(db, id);
  if (!questionnaire) return null;

  const questions =
    await questionnaireRepository.findQuestionsByQuestionnaireId(db, id);

  return formatQuestionnaireResponse(questionnaire, questions);
};

export const formatQuestionnaireResponse = (
  q: Questionnaire,
  questions: QuestionnaireQuestion[],
) => ({
  id: q.id,
  title: q.title,
  description: q.description,
  isAnonymous: q.isAnonymous === 1,
  status: q.status,
  questions: questions.map((qq) => ({
    id: qq.id,
    questionnaireId: qq.questionnaireId,
    order: qq.order,
    text: qq.text,
    type: qq.type,
    required: qq.required === 1,
    choices: qq.choices ? (JSON.parse(qq.choices) as string[]) : null,
  })),
  createdBy: q.createdBy,
  createdAt: q.createdAt,
  updatedAt: q.updatedAt,
  scheduledAt: q.scheduledAt,
  sentAt: q.sentAt,
  closedAt: q.closedAt,
});
