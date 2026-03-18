import { z } from "zod";

export const MessagingChannelSchema = z.enum(["slack", "telegram"]);

export const MessagingTransportSchema = z.enum([
  "socket_mode",
  "long_polling"
]);

export const MessagingConnectionStatusSchema = z.enum([
  "connecting",
  "connected",
  "degraded",
  "disconnected",
  "error",
  "disabled"
]);

export const MessagingConnectionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  channel: MessagingChannelSchema,
  transport: MessagingTransportSchema,
  status: MessagingConnectionStatusSchema,
  enabled: z.boolean(),
  accountLabel: z.string().min(1),
  externalWorkspaceId: z.string().min(1),
  externalWorkspaceLabel: z.string().min(1).nullable().optional(),
  connectedAt: z.string().datetime().nullable(),
  lastInboundAt: z.string().datetime().nullable(),
  lastOutboundAt: z.string().datetime().nullable(),
  lastError: z.string().min(1).nullable(),
  updatedAt: z.string().datetime()
});

export const ExternalConversationBindingSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  outcomeId: z.string().min(1),
  channel: MessagingChannelSchema,
  connectionId: z.string().min(1),
  externalWorkspaceId: z.string().min(1),
  conversationId: z.string().min(1),
  threadId: z.string().min(1).nullable(),
  lastInboundMessageId: z.string().min(1).nullable(),
  lastOutboundDeliveryId: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const MessagingInboundMessageSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  connectionId: z.string().min(1),
  channel: MessagingChannelSchema,
  externalWorkspaceId: z.string().min(1),
  conversationId: z.string().min(1),
  threadId: z.string().min(1).nullable(),
  externalMessageId: z.string().min(1),
  senderId: z.string().min(1),
  senderDisplayName: z.string().min(1).nullable().optional(),
  text: z.string().min(1),
  receivedAt: z.string().datetime(),
  dedupeKey: z.string().min(1)
});

export const MessagingDeliveryKindSchema = z.enum([
  "status_update",
  "result_summary",
  "approval_notification"
]);

export const MessagingDeliveryStatusSchema = z.enum([
  "pending",
  "sent",
  "failed"
]);

export const MessagingDeliverySchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    connectionId: z.string().min(1),
    channel: MessagingChannelSchema,
    externalWorkspaceId: z.string().min(1),
    conversationId: z.string().min(1),
    threadId: z.string().min(1).nullable(),
    kind: MessagingDeliveryKindSchema,
    status: MessagingDeliveryStatusSchema,
    body: z.string().min(1),
    outcomeId: z.string().min(1).nullable(),
    runId: z.string().min(1).nullable(),
    sentAt: z.string().datetime().nullable(),
    lastAttemptAt: z.string().datetime(),
    errorMessage: z.string().min(1).nullable()
  })
  .superRefine((delivery, ctx) => {
    if (delivery.status === "sent" && delivery.sentAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sentAt"],
        message: "Sent deliveries require sentAt."
      });
    }

    if (delivery.status === "failed" && delivery.errorMessage === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["errorMessage"],
        message: "Failed deliveries require errorMessage."
      });
    }
  });

export type MessagingChannel = z.infer<typeof MessagingChannelSchema>;
export type MessagingTransport = z.infer<typeof MessagingTransportSchema>;
export type MessagingConnectionStatus = z.infer<
  typeof MessagingConnectionStatusSchema
>;
export type MessagingConnection = z.infer<typeof MessagingConnectionSchema>;
export type ExternalConversationBinding = z.infer<
  typeof ExternalConversationBindingSchema
>;
export type MessagingInboundMessage = z.infer<
  typeof MessagingInboundMessageSchema
>;
export type MessagingDeliveryKind = z.infer<typeof MessagingDeliveryKindSchema>;
export type MessagingDeliveryStatus = z.infer<
  typeof MessagingDeliveryStatusSchema
>;
export type MessagingDelivery = z.infer<typeof MessagingDeliverySchema>;
