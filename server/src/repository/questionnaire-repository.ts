import { and, desc, eq, sql } from "drizzle-orm";

import {
  createDb,
  type Questionnaire,
  type QuestionnaireAnswer,
  type QuestionnaireQuestion,
  type QuestionnaireSubmission,
  questionnaireAnswers,
  questionnaireQuestions,
  questionnaireSubmissions,
  questionnaires,
} from "~/db";

type QuestionnaireStatus = Questionnaire["status"];
type QuestionTypeValue = QuestionnaireQuestion["type"];

type CreateQuestionnaireInput = {
  id: string;
  title: string;
  description?: string | null;
  isAnonymous: number;
  status: QuestionnaireStatus;
  createdBy: string;
  createdAt: string;
};

type CreateQuestionInput = {
  id: string;
  questionnaireId: string;
  order: number;
  text: string;
  type: QuestionTypeValue;
  required: number;
  choices?: string | null;
  createdAt: string;
};

type ListOptions = {
  limit?: number;
  cursor?: string;
  status?: QuestionnaireStatus;
};

export const questionnaireRepository = {
  // --- Questionnaire CRUD ---

  async create(d1: D1Database, input: CreateQuestionnaireInput) {
    const db = createDb(d1);
    await db.insert(questionnaires).values({
      id: input.id,
      title: input.title,
      description: input.description ?? null,
      isAnonymous: input.isAnonymous,
      status: input.status,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
    });
    return input.id;
  },

  async update(
    d1: D1Database,
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      isAnonymous: number;
      status: QuestionnaireStatus;
      scheduledAt: string | null;
      sentAt: string | null;
      closedAt: string | null;
    }>,
  ) {
    const db = createDb(d1);
    await db
      .update(questionnaires)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(questionnaires.id, id));
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);
    return (
      (await db
        .select()
        .from(questionnaires)
        .where(eq(questionnaires.id, id))
        .get()) ?? null
    );
  },

  async findAll(d1: D1Database, options: ListOptions = {}) {
    const db = createDb(d1);
    const limit = options.limit ?? 30;

    const conditions = [];
    if (options.status) {
      conditions.push(eq(questionnaires.status, options.status));
    }
    if (options.cursor) {
      conditions.push(sql`${questionnaires.createdAt} < ${options.cursor}`);
    }

    const items = await db
      .select()
      .from(questionnaires)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(questionnaires.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? result[result.length - 1]?.createdAt : null;

    return { questionnaires: result, nextCursor, hasMore };
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);
    await db
      .delete(questionnaireAnswers)
      .where(
        sql`${questionnaireAnswers.submissionId} IN (SELECT id FROM questionnaire_submissions WHERE questionnaire_id = ${id})`,
      );
    await db
      .delete(questionnaireSubmissions)
      .where(eq(questionnaireSubmissions.questionnaireId, id));
    await db
      .delete(questionnaireQuestions)
      .where(eq(questionnaireQuestions.questionnaireId, id));
    await db.delete(questionnaires).where(eq(questionnaires.id, id));
  },

  async count(d1: D1Database, status?: QuestionnaireStatus) {
    const db = createDb(d1);
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(questionnaires)
      .where(status ? eq(questionnaires.status, status) : undefined)
      .get();
    return result?.count ?? 0;
  },

  async findScheduledReady(d1: D1Database) {
    const db = createDb(d1);
    const now = new Date().toISOString();
    return db
      .select()
      .from(questionnaires)
      .where(
        and(
          eq(questionnaires.status, "scheduled"),
          sql`${questionnaires.scheduledAt} <= ${now}`,
        ),
      )
      .all();
  },

  // --- Questions ---

  async createQuestions(d1: D1Database, inputs: CreateQuestionInput[]) {
    const db = createDb(d1);
    if (inputs.length === 0) return;
    await db.insert(questionnaireQuestions).values(inputs);
  },

  async findQuestionsByQuestionnaireId(
    d1: D1Database,
    questionnaireId: string,
  ) {
    const db = createDb(d1);
    return db
      .select()
      .from(questionnaireQuestions)
      .where(eq(questionnaireQuestions.questionnaireId, questionnaireId))
      .orderBy(questionnaireQuestions.order)
      .all();
  },

  async deleteQuestionsByQuestionnaireId(
    d1: D1Database,
    questionnaireId: string,
  ) {
    const db = createDb(d1);
    await db
      .delete(questionnaireQuestions)
      .where(eq(questionnaireQuestions.questionnaireId, questionnaireId));
  },

  // --- Submissions ---

  async findSubmission(
    d1: D1Database,
    questionnaireId: string,
    userId: string,
  ) {
    const db = createDb(d1);
    return (
      (await db
        .select()
        .from(questionnaireSubmissions)
        .where(
          and(
            eq(questionnaireSubmissions.questionnaireId, questionnaireId),
            eq(questionnaireSubmissions.userId, userId),
          ),
        )
        .get()) ?? null
    );
  },

  async createSubmission(
    d1: D1Database,
    input: {
      id: string;
      questionnaireId: string;
      userId: string;
      currentQuestionOrder: number;
      createdAt: string;
    },
  ) {
    const db = createDb(d1);
    await db.insert(questionnaireSubmissions).values(input);
    return input.id;
  },

  async updateSubmission(
    d1: D1Database,
    id: string,
    input: Partial<{
      currentQuestionOrder: number;
      completedAt: string | null;
    }>,
  ) {
    const db = createDb(d1);
    await db
      .update(questionnaireSubmissions)
      .set(input)
      .where(eq(questionnaireSubmissions.id, id));
  },

  async countSubmissions(d1: D1Database, questionnaireId: string) {
    const db = createDb(d1);
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(questionnaireSubmissions)
      .where(eq(questionnaireSubmissions.questionnaireId, questionnaireId))
      .get();

    const completed = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(questionnaireSubmissions)
      .where(
        and(
          eq(questionnaireSubmissions.questionnaireId, questionnaireId),
          sql`${questionnaireSubmissions.completedAt} IS NOT NULL`,
        ),
      )
      .get();

    return {
      total: total?.count ?? 0,
      completed: completed?.count ?? 0,
    };
  },

  // --- Answers ---

  async createAnswer(
    d1: D1Database,
    input: {
      id: string;
      submissionId: string;
      questionId: string;
      answerText?: string | null;
      answerNumber?: number | null;
      selectedChoices?: string | null;
      createdAt: string;
    },
  ) {
    const db = createDb(d1);
    await db.insert(questionnaireAnswers).values(input);
  },

  async findAnswersByQuestionId(d1: D1Database, questionId: string) {
    const db = createDb(d1);
    return db
      .select()
      .from(questionnaireAnswers)
      .where(eq(questionnaireAnswers.questionId, questionId))
      .all();
  },

  async findAnswersBySubmissionId(d1: D1Database, submissionId: string) {
    const db = createDb(d1);
    return db
      .select()
      .from(questionnaireAnswers)
      .where(eq(questionnaireAnswers.submissionId, submissionId))
      .all();
  },
};

export type {
  Questionnaire,
  QuestionnaireAnswer,
  QuestionnaireQuestion,
  QuestionnaireSubmission,
};
