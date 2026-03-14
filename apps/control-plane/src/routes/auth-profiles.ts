import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AuthProfileSchema,
  AuthProfileStatusSchema
} from "@computer-oss/protocol";
import { getProviderCatalog } from "@computer-oss/router";
import type { EncryptionService } from "../lib/encryption";
import { EncryptionConfigError } from "../lib/encryption";
import type { Repositories } from "../lib/repositories";

const CreateAuthProfileRequestSchema = z.object({
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  credentialId: z.string().min(1),
  priority: z.number().int().nonnegative(),
  status: AuthProfileStatusSchema.default("active"),
  cooldownUntil: z.string().datetime().nullable().optional()
});

const UpdateAuthProfileRequestSchema = z.object({
  label: z.string().min(1).optional(),
  credentialId: z.string().min(1).optional(),
  priority: z.number().int().nonnegative().optional(),
  status: AuthProfileStatusSchema.optional(),
  cooldownUntil: z.string().datetime().nullable().optional()
});

type AuthProfileRouteOptions = {
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

export function registerAuthProfileRoutes(
  app: FastifyInstance,
  options: AuthProfileRouteOptions
): void {
  app.get("/api/auth-profiles", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const authProfiles = await options.repositories.authProfiles.listByWorkspace(
      query.workspaceId
    );

    return reply.code(200).send({
      authProfiles: authProfiles.map((profile) => AuthProfileSchema.parse(profile))
    });
  });

  app.post("/api/auth-profiles", async (request, reply) => {
    const parsed = CreateAuthProfileRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid auth profile payload."));
    }

    if (!hasProvider(parsed.data.providerId)) {
      return reply.code(400).send(badRequest("Unknown provider."));
    }

    try {
      const now = new Date().toISOString();
      const created = await options.repositories.authProfiles.create({
        id: `profile_${crypto.randomUUID()}`,
        workspaceId: parsed.data.workspaceId,
        providerId: parsed.data.providerId,
        label: parsed.data.label,
        credentialId: parsed.data.credentialId,
        priority: parsed.data.priority,
        status: parsed.data.status,
        cooldownUntil: parsed.data.cooldownUntil ?? null,
        lastValidatedAt: null,
        createdAt: now,
        updatedAt: now
      });

      return reply.code(201).send(AuthProfileSchema.parse(created));
    } catch (error) {
      if (error instanceof Error && error.message.includes("belongs to")) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }
  });

  app.patch("/api/auth-profiles/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = UpdateAuthProfileRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Auth profile id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid auth profile payload."));
    }

    const updated = await options.repositories.authProfiles.update({
      id: params.id,
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.credentialId !== undefined
        ? { credentialId: parsed.data.credentialId }
        : {}),
      ...(parsed.data.priority !== undefined
        ? { priority: parsed.data.priority }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.cooldownUntil !== undefined
        ? { cooldownUntil: parsed.data.cooldownUntil }
        : {}),
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      return reply.code(404).send(badRequest("Auth profile not found."));
    }

    return reply.code(200).send(AuthProfileSchema.parse(updated));
  });

  app.delete("/api/auth-profiles/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Auth profile id is required."));
    }

    try {
      const deleted = await options.repositories.authProfiles.delete(params.id);

      if (!deleted) {
        return reply.code(404).send(badRequest("Auth profile not found."));
      }

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("violates foreign key constraint")) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }
  });

  app.post("/api/auth-profiles/:id/validate", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Auth profile id is required."));
    }

    const profile = await options.repositories.authProfiles.getById(params.id);

    if (!profile) {
      return reply.code(404).send(badRequest("Auth profile not found."));
    }

    if (!hasProvider(profile.providerId)) {
      return reply.code(409).send(badRequest("Unknown provider."));
    }

    const credential = await options.repositories.workspaceCredentials.getStoredById(
      profile.credentialId
    );

    if (!credential) {
      return reply.code(409).send(badRequest("Credential not found."));
    }

    if (credential.workspaceId !== profile.workspaceId) {
      return reply.code(409).send(
        badRequest(
          `Credential ${credential.id} belongs to workspace ${credential.workspaceId}, not ${profile.workspaceId}.`
        )
      );
    }

    if (credential.providerId !== profile.providerId) {
      return reply.code(409).send(
        badRequest(
          `Credential ${credential.id} belongs to provider ${credential.providerId}, not ${profile.providerId}.`
        )
      );
    }

    try {
      options.encryption.decryptSecret(credential);
    } catch (error) {
      if (error instanceof EncryptionConfigError) {
        return reply.code(500).send(badRequest(error.message));
      }

      throw error;
    }

    const now = new Date().toISOString();
    await options.repositories.workspaceCredentials.update({
      id: credential.id,
      lastValidatedAt: now,
      updatedAt: now
    });
    const updatedProfile = await options.repositories.authProfiles.update({
      id: profile.id,
      lastValidatedAt: now,
      updatedAt: now
    });

    return reply.code(200).send({
      ok: true,
      validatedAt: now,
      authProfile: updatedProfile ? AuthProfileSchema.parse(updatedProfile) : null
    });
  });
}
