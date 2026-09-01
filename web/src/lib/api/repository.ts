import { createAdminUserRepository } from "@nepp-chan/shared/api/repository/admin-user-repository";
import { createAnalyticsRepository } from "@nepp-chan/shared/api/repository/analytics-repository";
import { createBroadcastRepository } from "@nepp-chan/shared/api/repository/broadcast-repository";
import { createCorrectionRepository } from "@nepp-chan/shared/api/repository/correction-repository";
import { createEmergencyRepository } from "@nepp-chan/shared/api/repository/emergency-repository";
import { createFeedbackRepository } from "@nepp-chan/shared/api/repository/feedback-repository";
import { createInvitationRepository } from "@nepp-chan/shared/api/repository/invitation-repository";
import { createKnowledgeRepository } from "@nepp-chan/shared/api/repository/knowledge-repository";
import { createPersonaRepository } from "@nepp-chan/shared/api/repository/persona-repository";
import { createPollRepository } from "@nepp-chan/shared/api/repository/poll-repository";
import { createReviewRepository } from "@nepp-chan/shared/api/repository/review-repository";
import { createSourceCandidateRepository } from "@nepp-chan/shared/api/repository/source-candidate-repository";
import { createThreadRepository } from "@nepp-chan/shared/api/repository/thread-repository";
import { createWidgetSiteRepository } from "@nepp-chan/shared/api/repository/widget-site-repository";

import { API_BASE, client } from "./client";

/**
 * shared/api/repository の factory を web の client で合成した repository 群。
 * domain ごとに名前空間として export する。
 */
export const adminUserRepository = createAdminUserRepository(client);
export const analyticsRepository = createAnalyticsRepository(client);
export const broadcastRepository = createBroadcastRepository(client);
export const correctionRepository = createCorrectionRepository(client);
export const emergencyRepository = createEmergencyRepository(client);
export const feedbackRepository = createFeedbackRepository(client);
export const invitationRepository = createInvitationRepository(client);
export const knowledgeRepository = createKnowledgeRepository(client, API_BASE);
export const personaRepository = createPersonaRepository(client);
export const pollRepository = createPollRepository(client);
export const reviewRepository = createReviewRepository(client);
export const sourceCandidateRepository =
  createSourceCandidateRepository(client);
export const threadRepository = createThreadRepository(client);
export const widgetSiteRepository = createWidgetSiteRepository(client);
