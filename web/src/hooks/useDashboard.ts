import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchEmergencies } from "~/repository/emergency-repository";
import {
  deleteAllKnowledge,
  syncKnowledge,
} from "~/repository/knowledge-repository";
import { fetchPersonas } from "~/repository/persona-repository";

export const dashboardKeys = {
  personas: ["dashboard", "personas"] as const,
  emergencies: ["dashboard", "emergencies"] as const,
};

export const usePersonas = (limit = 100) =>
  useQuery({
    queryKey: dashboardKeys.personas,
    queryFn: () => fetchPersonas(limit),
  });

export const useEmergencies = (limit = 100) =>
  useQuery({
    queryKey: dashboardKeys.emergencies,
    queryFn: () => fetchEmergencies(limit),
  });

export const useSyncKnowledge = () =>
  useMutation({
    mutationFn: syncKnowledge,
  });

export const useDeleteKnowledge = () =>
  useMutation({
    mutationFn: deleteAllKnowledge,
  });
