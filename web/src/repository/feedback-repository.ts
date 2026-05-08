import { createFeedbackRepository } from "@nepp-chan/shared/api/repository/feedback-repository";
import { client } from "~/lib/api/client";

const repo = createFeedbackRepository(client);

export const {
  submitFeedback,
  fetchFeedbacks,
  fetchFeedbackById,
  deleteAllFeedbacks,
  resolveFeedback,
  unresolveFeedback,
} = repo;
