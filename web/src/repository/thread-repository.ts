import { createThreadRepository } from "@nepp-chan/shared/api/repository/thread-repository";
import { client } from "~/lib/api/client";

const repo = createThreadRepository(client);

export const {
  fetchThreads,
  createThread,
  deleteThread,
  fetchThread,
  fetchMessages,
} = repo;
