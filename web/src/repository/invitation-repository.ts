import { createInvitationRepository } from "@nepp-chan/shared/api/repository/invitation-repository";
import { client } from "~/lib/api/client";

const repo = createInvitationRepository(client);

export const { fetchInvitations, createInvitation, deleteInvitation } = repo;
