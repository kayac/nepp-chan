import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tagGroupRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

const invalidateTagGroups = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: dashboardKeys.tagGroups }),
    queryClient.invalidateQueries({
      queryKey: dashboardKeys.analyticsAudiencesAll,
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardKeys.analyticsPersonaAll,
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardKeys.analyticsOntology,
    }),
  ]);

export const useTagGroups = () =>
  useQuery({
    queryKey: dashboardKeys.tagGroups,
    queryFn: tagGroupRepository.fetchTagGroups,
  });

export const useSetTagAlias = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tag, groupId }: { tag: string; groupId: string | null }) =>
      tagGroupRepository.setTagAlias(tag, groupId),
    onSuccess: () => invalidateTagGroups(queryClient),
  });
};

// 1 回の API 呼び出しは 1 バッチだけなので、残りが 0 になるまで繰り返す
export const useAssignTagGroups = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      let assigned = 0;
      let unassigned = 0;
      let remaining = 0;
      do {
        const result = await tagGroupRepository.assignTagGroups();
        assigned += result.assigned;
        unassigned += result.unassigned;
        remaining = result.remaining;
      } while (remaining > 0);
      return { assigned, unassigned };
    },
    onSuccess: () => invalidateTagGroups(queryClient),
  });
};
