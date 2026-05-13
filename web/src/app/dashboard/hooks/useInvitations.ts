import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminUser } from "~/lib/api/auth";
import { invitationRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useInvitations = () =>
  useQuery({
    queryKey: dashboardKeys.invitations,
    queryFn: invitationRepository.fetchInvitations,
  });

export const useCreateInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      role,
    }: {
      username: string;
      role: AdminUser["role"];
    }) => invitationRepository.createInvitation(username, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.invitations });
    },
  });
};

export const useDeleteInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: invitationRepository.deleteInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.invitations });
    },
  });
};
