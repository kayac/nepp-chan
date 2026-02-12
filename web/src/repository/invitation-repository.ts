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

export const fetchInvitations = (): Promise<InvitationsResponse> =>
  apiClient<InvitationsResponse>("/admin/invitations");

export const createInvitation = (
  email: string,
): Promise<CreateInvitationResponse> =>
  apiClient<CreateInvitationResponse>("/admin/invitations", {
    method: "POST",
    body: { email },
  });

export const deleteInvitation = (id: string): Promise<void> =>
  apiClient<void>(`/admin/invitations/${id}`, {
    method: "DELETE",
  });
