import { createPersonaRepository } from "@nepp-chan/shared/api/repository/persona-repository";
import { client } from "~/lib/api/client";

const repo = createPersonaRepository(client);

export const { fetchPersonas, extractPersonas, deleteAllPersonas } = repo;
