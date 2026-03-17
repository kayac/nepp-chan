import { z } from "zod";

export const broadcastStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sent",
  "failed",
]);

export const broadcastMessageSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const createBroadcastSchema = z.object({
  body: z.string().min(1).max(5000),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
});

export const updateBroadcastSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});
