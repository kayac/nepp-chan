import { createBroadcastRepository } from "@nepp-chan/shared/api/repository/broadcast-repository";
import { client } from "~/lib/api/client";

const repo = createBroadcastRepository(client);

export const {
  fetchBroadcasts,
  fetchBroadcastById,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  sendBroadcastNow,
  uploadBroadcastImage,
} = repo;
