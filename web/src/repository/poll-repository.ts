import { createPollRepository } from "@nepp-chan/shared/api/repository/poll-repository";
import { client } from "~/lib/api/client";

const repo = createPollRepository(client);

export const {
  fetchPolls,
  fetchPollById,
  createPoll,
  updatePoll,
  deletePoll,
  sendPollNow,
  closePoll,
  fetchPollResultsAdmin,
  fetchPollResults,
} = repo;
