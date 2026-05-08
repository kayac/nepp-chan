import { createEmergencyRepository } from "@nepp-chan/shared/api/repository/emergency-repository";
import { client } from "~/lib/api/client";

const repo = createEmergencyRepository(client);

export const { fetchEmergencies } = repo;
