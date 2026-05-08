import { createBroadcastRepository } from "@nepp-chan/shared/api/repository/broadcast-repository";
import { createEmergencyRepository } from "@nepp-chan/shared/api/repository/emergency-repository";
import { createFeedbackRepository } from "@nepp-chan/shared/api/repository/feedback-repository";
import { createInvitationRepository } from "@nepp-chan/shared/api/repository/invitation-repository";
import { createKnowledgeRepository } from "@nepp-chan/shared/api/repository/knowledge-repository";
import { createPersonaRepository } from "@nepp-chan/shared/api/repository/persona-repository";
import { createPollRepository } from "@nepp-chan/shared/api/repository/poll-repository";
import { createThreadRepository } from "@nepp-chan/shared/api/repository/thread-repository";

import { API_BASE, client } from "~/lib/api/client";

/**
 * shared/api/repository の factory 群を web の client で合成し、
 * 名前付き関数として一括 export する。
 * ここが web における API 呼び出しの単一エントリ。
 */
export const {
  // broadcast
  fetchBroadcasts,
  fetchBroadcastById,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  sendBroadcastNow,
  uploadBroadcastImage,
  // emergency
  fetchEmergencies,
  // feedback
  submitFeedback,
  fetchFeedbacks,
  fetchFeedbackById,
  deleteAllFeedbacks,
  resolveFeedback,
  unresolveFeedback,
  // invitation
  fetchInvitations,
  createInvitation,
  deleteInvitation,
  // knowledge
  syncKnowledge,
  deleteAllKnowledge,
  fetchFiles,
  fetchFileContent,
  saveFile,
  deleteFile,
  uploadFile,
  convertFile,
  fetchUnifiedFiles,
  reconvertFile,
  getOriginalFileUrl,
  // persona
  fetchPersonas,
  extractPersonas,
  deleteAllPersonas,
  // poll
  fetchPolls,
  fetchPollById,
  createPoll,
  updatePoll,
  deletePoll,
  sendPollNow,
  closePoll,
  fetchPollResultsAdmin,
  fetchPollResults,
  // thread
  fetchThreads,
  createThread,
  deleteThread,
  fetchThread,
  fetchMessages,
} = {
  ...createBroadcastRepository(client),
  ...createEmergencyRepository(client),
  ...createFeedbackRepository(client),
  ...createInvitationRepository(client),
  ...createKnowledgeRepository(client, API_BASE),
  ...createPersonaRepository(client),
  ...createPollRepository(client),
  ...createThreadRepository(client),
};
