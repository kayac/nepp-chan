import { z } from "zod";

export const broadcastStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sent",
  "failed",
]);

export const broadcastPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1).max(5000) }),
  z.object({
    type: z.literal("image"),
    imageR2Key: z.string().min(1),
    imageDescription: z.string().max(5000).optional(),
  }),
]);

export type BroadcastPart = z.infer<typeof broadcastPartSchema>;

export const broadcastMessageSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  parts: z.string().nullable(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const createBroadcastSchema = z.object({
  parts: z.array(broadcastPartSchema).min(1).max(5),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
});

export const updateBroadcastSchema = z.object({
  parts: z.array(broadcastPartSchema).min(1).max(5).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});
