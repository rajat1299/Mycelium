import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  WorkspaceCredentialMetadataSchema,
  WorkspaceCredentialStatusSchema
} from "@computer-oss/protocol";
import { getProviderCatalog } from "@computer-oss/router";
import type { EncryptionService } from "../lib/encryption";
import { EncryptionConfigError } from "../lib/encryption";
import type { Repositories } from "../lib/repositories";

const CreateWorkspaceCredentialRequestSchema = z.object({
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  secret: z.string().min(1)
});

const UpdateWorkspaceCredentialRequestSchema = z.object({
  label: z.string().min(1).optional(),
  status: WorkspaceCredentialStatusSchema.optional(),
  secret: z.string().min(1).optional()
});

type WorkspaceCredentialRouteOptions = {
  repositories: Repositories;
  encryption: EncryptionService;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

function hasProvider(providerId: string) {
  return getProviderCatalog().providers.some((provider) => provider.id === providerId);
}

export function registerWorkspaceCredentialRoutes(
  app: FastifyInstance,
  options: WorkspaceCredentialRouteOptions
): void {
  app.get("/api/workspace-credentials", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const credentials = await options.repositories.workspaceCredentials.listByWorkspace(
      query.workspaceId
    );

    return reply.code(200).send({
      credentials: credentials.map((credential) =>
        WorkspaceCredentialMetadataSchema.parse(credential)
      )
    });
  });

  app.post("/api/workspace-credentials", async (request, reply) => {
    const parsed = CreateWorkspaceCredentialRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid workspace credential payload."));
    }

    if (!hasProvider(parsed.data.providerId)) {
      return reply.code(400).send(badRequest("Unknown provider."));
    }

    try {
      const encrypted = options.encryption.encryptSecret(parsed.data.secret);
      const now = new Date().toISOString();
      const created = await options.repositories.workspaceCredentials.create({
        id: `cred_${crypto.randomUUID()}`,
        workspaceId: parsed.data.workspaceId,
        providerId: parsed.data.providerId,
        label: parsed.data.label,
        ...encrypted,
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastValidatedAt: null
      });

      return reply.code(201).send(WorkspaceCredentialMetadataSchema.parse(created));
    } catch (error) {
      if (error instanceof EncryptionConfigError) {
        return reply.code(500).send(badRequest(error.message));
      }

      throw error;
    }
  });

  app.patch("/api/workspace-credentials/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = UpdateWorkspaceCredentialRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Credential id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid workspace credential payload."));
    }

    const current = await options.repositories.workspaceCredentials.getById(params.id);

    if (!current) {
      return reply.code(404).send(badRequest("Workspace credential not found."));
    }

    try {
      const encrypted = parsed.data.secret
        ? options.encryption.encryptSecret(parsed.data.secret)
        : null;
      const updated = await options.repositories.workspaceCredentials.update({
        id: params.id,
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(encrypted ?? {}),
        updatedAt: new Date().toISOString()
      });

      if (!updated) {
        return reply.code(404).send(badRequest("Workspace credential not found."));
      }

      return reply.code(200).send(WorkspaceCredentialMetadataSchema.parse(updated));
    } catch (error) {
      if (error instanceof EncryptionConfigError) {
        return reply.code(500).send(badRequest(error.message));
      }

      throw error;
    }
  });

  app.delete("/api/workspace-credentials/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Credential id is required."));
    }

    try {
      const deleted = await options.repositories.workspaceCredentials.delete(params.id);

      if (!deleted) {
        return reply.code(404).send(badRequest("Workspace credential not found."));
      }

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("violates foreign key constraint")) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }
  });
}
