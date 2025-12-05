import { z } from "zod";

export const ChatSendResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    threadId: z.string(),
    message: z.string(),
  }),
});

export type ChatSendResponse = z.infer<typeof ChatSendResponseSchema>;
