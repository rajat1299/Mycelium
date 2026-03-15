import type { FastifyInstance } from "fastify";
import { createDeterministicDraftPlan, validatePlanGraph } from "@computer-oss/orchestrator";
import { PlanSchema } from "@computer-oss/protocol";
import type { EventBus } from "../lib/event-bus";
import type { Repositories } from "../lib/repositories";

type PlanRouteOptions = {
  repositories: Repositories;
  eventBus: EventBus;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

async function buildPlanResponse(
  repositories: Repositories,
  outcomeId: string
): Promise<ReturnType<typeof PlanSchema.parse> | null> {
  const plan = await repositories.plans.getByOutcome(outcomeId);

  if (!plan) {
    return null;
  }

  const [nodes, edges] = await Promise.all([
    repositories.plans.listNodes(plan.id),
    repositories.plans.listEdges(plan.id)
  ]);

  return PlanSchema.parse({
    ...plan,
    nodes,
    edges
  });
}

export function registerPlanRoutes(
  app: FastifyInstance,
  options: PlanRouteOptions
): void {
  app.post("/api/outcomes/:id/plan", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const now = new Date().toISOString();
    const draftPlan = createDeterministicDraftPlan({
      outcomeId: outcome.id,
      prompt: outcome.prompt,
      createdAt: now,
      updatedAt: now
    });
    const validation = validatePlanGraph(draftPlan);

    if (!validation.ok) {
      return reply.code(500).send(
        badRequest(
          `Generated plan is invalid: ${validation.errors.join("; ")}`
        )
      );
    }

    try {
      await options.repositories.plans.create({
        id: draftPlan.id,
        outcomeId: draftPlan.outcomeId,
        status: draftPlan.status,
        createdAt: draftPlan.createdAt,
        updatedAt: draftPlan.updatedAt,
        nodes: draftPlan.nodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          title: node.title,
          capability: node.capability,
          instruction: node.instruction,
          template: node.template,
          approvalRequirement: node.approvalRequirement,
          expectedArtifactPath: node.expectedArtifactPath,
          expectedArtifactKind: node.expectedArtifactKind
        })),
        edges: draftPlan.edges
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }

    const response = await buildPlanResponse(options.repositories, outcome.id);

    if (!response) {
      return reply.code(500).send(badRequest("Failed to read persisted plan."));
    }

    options.eventBus.publish({
      outcomeId: outcome.id,
      type: "plan.created",
      data: response
    });

    return reply.code(201).send(response);
  });

  app.get("/api/outcomes/:id/plan", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const response = await buildPlanResponse(options.repositories, outcome.id);

    if (!response) {
      return reply.code(404).send(badRequest("Plan not found."));
    }

    return reply.code(200).send(response);
  });
}
