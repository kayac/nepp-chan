import { z } from "zod";

export const ChatSendRequestSchema = z.object({
  message: z.string().min(1),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
});

export type ChatSendRequest = z.infer<typeof ChatSendRequestSchema>;
