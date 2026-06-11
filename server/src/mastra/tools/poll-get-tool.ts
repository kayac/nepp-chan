import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { type Poll, pollRepository } from "~/repository/poll-repository";
import { getPollResults } from "~/services/poll-results";
import { requireDb } from "./helpers";

const pollWithResultsSchema = z.object({
  id: z.string(),
  title: z.string(),
  choices: z.array(z.string()),
  status: z.enum(["draft", "scheduled", "sent", "closed"]),
  sentAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  totalSubmissions: z.number(),
  choiceResults: z.array(
    z.object({
      choice: z.string(),
      count: z.number(),
      percentage: z.number(),
    }),
  ),
});

type PollWithResults = z.infer<typeof pollWithResultsSchema>;

/** エージェント登録キーと instructions 内の参照を一致させるための toolName */
export const pollGetToolName = "pollGetTool";

export const pollGetTool = createTool({
  id: "poll-get",
  description:
    "過去の投票とその集計結果を取得します。IDで特定の投票を指定するか、件数を指定して最新の配信済み（sent/closed）投票一覧を取得できます。結果の分析や傾向把握に利用します。",
  inputSchema: z.object({
    id: z
      .string()
      .optional()
      .describe("投票のID。特定の投票を取得する場合に指定"),
    limit: z
      .number()
      .int()
      .positive()
      .max(20)
      .default(10)
      .describe("取得する最大件数（一覧取得時）。デフォルトは10件"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    polls: z.array(pollWithResultsSchema),
    count: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const result = requireDb(context);
    if ("error" in result) {
      return {
        success: false,
        polls: [],
        count: 0,
        message: result.error.message,
        error: result.error.error,
      };
    }
    const { db } = result;
    const { id, limit } = inputData;

    try {
      if (id) {
        const poll = await pollRepository.findById(db, id);
        if (!poll || (poll.status !== "sent" && poll.status !== "closed")) {
          return {
            success: true,
            polls: [],
            count: 0,
            message: "指定されたIDの投票が見つかりません",
          };
        }
        return {
          success: true,
          polls: [await buildPollWithResults(db, poll)],
          count: 1,
          message: "投票を取得しました",
        };
      }

      const listResult = await pollRepository.findAll(db, {
        limit,
        status: ["sent", "closed"],
      });

      const polls = await Promise.all(
        listResult.polls.map((p) => buildPollWithResults(db, p)),
      );

      return {
        success: true,
        polls,
        count: polls.length,
        message: `配信済みの投票を${polls.length}件取得しました`,
      };
    } catch (error) {
      logger.error("Poll fetch failed", error);
      return {
        success: false,
        polls: [],
        count: 0,
        message: "投票の取得に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const buildPollWithResults = async (
  db: D1Database,
  poll: Poll,
): Promise<PollWithResults> => {
  const results = await getPollResults(db, poll.id);
  return {
    id: poll.id,
    title: poll.title,
    choices: JSON.parse(poll.choices) as string[],
    status: poll.status,
    sentAt: poll.sentAt,
    closedAt: poll.closedAt,
    totalSubmissions: results?.totalSubmissions ?? 0,
    choiceResults: results?.choiceResults ?? [],
  };
};
