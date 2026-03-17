import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  DaemonEventSchema,
  RemoteWorkerHeartbeatSchema,
  RemoteWorkerRegistrationSchema
} from "@computer-oss/protocol";
import type { RemoteProvider } from "@computer-oss/sandbox";
import type { DaemonGateway } from "../lib/daemon-gateway";

const DisconnectWorkerRequestSchema = z.object({
  workerId: z.string().min(1),
  workerSessionId: z.string().min(1),
  disconnectedAt: z.string().datetime()
});
const ClaimCommandsRequestSchema = z.object({
  workerId: z.string().min(1),
  workerSessionId: z.string().min(1)
});

type WorkerDaemonRouteOptions = {
  daemonGateway: DaemonGateway;
  daemonAuthToken: string;
  remoteProvider: Pick<RemoteProvider, "claimCommands">;
};

function errorResponse(message: string) {
  return {
    error: message
  };
}

function isAuthorized(appToken: string, headerValue: string | string[] | undefined) {
  return typeof headerValue === "string" && headerValue === appToken;
}

function conflictResponse(reply: FastifyReply, message: string) {
  return reply.code(409).send(errorResponse(message));
}

export function registerWorkerDaemonRoutes(
  app: FastifyInstance,
  options: WorkerDaemonRouteOptions
): void {
  app.post("/api/worker-daemon/register", async (request, reply) => {
    if (
      !isAuthorized(
        options.daemonAuthToken,
        request.headers["x-mycelium-daemon-token"]
      )
    ) {
      return reply.code(401).send(errorResponse("Unauthorized daemon token."));
    }

    const parsed = RemoteWorkerRegistrationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(errorResponse("Invalid worker registration payload."));
    }

    const worker = await options.daemonGateway.registerWorker(parsed.data);
    return reply.code(200).send({ worker });
  });

  app.post("/api/worker-daemon/heartbeat", async (request, reply) => {
    if (
      !isAuthorized(
        options.daemonAuthToken,
        request.headers["x-mycelium-daemon-token"]
      )
    ) {
      return reply.code(401).send(errorResponse("Unauthorized daemon token."));
    }

    const parsed = RemoteWorkerHeartbeatSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(errorResponse("Invalid worker heartbeat payload."));
    }

    const worker = await options.daemonGateway.recordHeartbeat(parsed.data);

    if (!worker) {
      return conflictResponse(
        reply,
        `Remote worker ${parsed.data.workerId} heartbeat does not match an active session.`
      );
    }

    return reply.code(200).send({ worker });
  });

  app.post("/api/worker-daemon/events", async (request, reply) => {
    if (
      !isAuthorized(
        options.daemonAuthToken,
        request.headers["x-mycelium-daemon-token"]
      )
    ) {
      return reply.code(401).send(errorResponse("Unauthorized daemon token."));
    }

    const parsed = DaemonEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(errorResponse("Invalid daemon event payload."));
    }

    try {
      await options.daemonGateway.ingestEvent(parsed.data);
    } catch (error) {
      return conflictResponse(
        reply,
        error instanceof Error ? error.message : "Daemon event rejected."
      );
    }

    return reply.code(202).send({ accepted: true });
  });

  app.post("/api/worker-daemon/commands/claim", async (request, reply) => {
    if (
      !isAuthorized(
        options.daemonAuthToken,
        request.headers["x-mycelium-daemon-token"]
      )
    ) {
      return reply.code(401).send(errorResponse("Unauthorized daemon token."));
    }

    const parsed = ClaimCommandsRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(errorResponse("Invalid command claim payload."));
    }

    return reply.code(200).send({
      commands: options.remoteProvider.claimCommands(parsed.data)
    });
  });

  app.post("/api/worker-daemon/disconnect", async (request, reply) => {
    if (
      !isAuthorized(
        options.daemonAuthToken,
        request.headers["x-mycelium-daemon-token"]
      )
    ) {
      return reply.code(401).send(errorResponse("Unauthorized daemon token."));
    }

    const parsed = DisconnectWorkerRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(errorResponse("Invalid worker disconnect payload."));
    }

    const worker = await options.daemonGateway.disconnectWorker(parsed.data);

    if (!worker) {
      return conflictResponse(
        reply,
        `Remote worker ${parsed.data.workerId} disconnect does not match an active session.`
      );
    }

    return reply.code(200).send({ worker });
  });
}
