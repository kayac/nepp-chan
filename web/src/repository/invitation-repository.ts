import { apiClient } from "~/lib/api/client";

export type Invitation = {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type InvitationsResponse = {
  invitations: Invitation[];
};

export type CreateInvitationResponse = {
  invitation: { token: string };
};

export const fetchInvitations = () =>
  apiClient<InvitationsResponse>("/admin/invitations");

export const createInvitation = (email: string) =>
  apiClient<CreateInvitationResponse>("/admin/invitations", {
    method: "POST",
    body: { email },
  });

export const deleteInvitation = (id: string) =>
  apiClient<void>(`/admin/invitations/${id}`, {
    method: "DELETE",
  });
