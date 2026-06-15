import { z } from "zod";

export const ENTITY_TYPES = [
  "place",
  "facility",
  "service",
  "institution",
  "event",
  "org",
] as const;

export const personaEntitySchema = z.object({
  name: z.string(),
  type: z.enum(ENTITY_TYPES),
});

export const personaEntitiesSchema = z.array(personaEntitySchema);

export type PersonaEntity = z.infer<typeof personaEntitySchema>;
