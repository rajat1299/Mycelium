import { z } from "zod";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const MessageCreatedDataSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime()
});

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type MessageCreatedData = z.infer<typeof MessageCreatedDataSchema>;
