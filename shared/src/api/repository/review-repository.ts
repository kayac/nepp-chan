import type { ApiClient } from "../create-client";

type FetchQueueParams = {
  limit?: number;
  cursor?: string;
  decided?: boolean;
};

type SubmitDecisionParams = {
  answerRunId: string;
  decision: "no_issue" | "incorrect" | "source_missing";
  comment?: string;
};

export const createReviewRepository = (client: ApiClient) => ({
  fetchQueue: async (params: FetchQueueParams = {}) => {
    const { data, error } = await client.GET("/admin/review", {
      params: {
        query: {
          limit: params.limit ?? 30,
          cursor: params.cursor,
          decided:
            params.decided === undefined
              ? undefined
              : params.decided
                ? ("true" as const)
                : ("false" as const),
        },
      },
    });
    if (error) throw error;
    return data;
  },

  fetchDetail: async (answerRunId: string) => {
    const { data, error } = await client.GET("/admin/review/{answerRunId}", {
      params: { path: { answerRunId } },
    });
    if (error) throw error;
    return data;
  },

  submitDecision: async ({ answerRunId, ...body }: SubmitDecisionParams) => {
    const { data, error } = await client.POST(
      "/admin/review/{answerRunId}/decision",
      {
        params: { path: { answerRunId } },
        body,
      },
    );
    if (error) throw error;
    return data;
  },
});

export type ReviewRepository = ReturnType<typeof createReviewRepository>;
