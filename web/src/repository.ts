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
 * shared/api/repository の factory を web の client で合成した repository 群。
 * domain ごとに名前空間として export する。
 */
export const broadcastRepository = createBroadcastRepository(client);
export const emergencyRepository = createEmergencyRepository(client);
export const feedbackRepository = createFeedbackRepository(client);
export const invitationRepository = createInvitationRepository(client);
export const knowledgeRepository = createKnowledgeRepository(client, API_BASE);
export const personaRepository = createPersonaRepository(client);
export const pollRepository = createPollRepository(client);
export const threadRepository = createThreadRepository(client);
