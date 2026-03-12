import type { StepStatus } from "./run-state";
import type { PlanGraph } from "./plan-graph";

export type SchedulerStepState = {
  id: string;
  planNodeId: string;
  status: StepStatus;
};

const terminalStatuses = new Set<StepStatus>([
  "completed",
  "failed",
  "cancelled"
]);

function createParentNodeMap(plan: PlanGraph) {
  const parentsByNodeId = new Map<string, string[]>(
    plan.nodes.map((node) => [node.id, []])
  );

  for (const edge of plan.edges) {
    parentsByNodeId.get(edge.to)?.push(edge.from);
  }

  return parentsByNodeId;
}

function createChildNodeMap(plan: PlanGraph) {
  const childrenByNodeId = new Map<string, string[]>(
    plan.nodes.map((node) => [node.id, []])
  );

  for (const edge of plan.edges) {
    childrenByNodeId.get(edge.from)?.push(edge.to);
  }

  return childrenByNodeId;
}

function createStepMap(steps: SchedulerStepState[]) {
  return new Map(steps.map((step) => [step.planNodeId, step]));
}

function dependenciesCompleted(
  planNodeId: string,
  planNodeIds: Set<string>,
  parentsByNodeId: Map<string, string[]>,
  stepsByPlanNodeId: Map<string, SchedulerStepState>
) {
  if (!planNodeIds.has(planNodeId)) {
    return false;
  }

  return (parentsByNodeId.get(planNodeId) ?? []).every(
    (parentNodeId) => stepsByPlanNodeId.get(parentNodeId)?.status === "completed"
  );
}

export function listReadySteps(
  plan: PlanGraph,
  steps: SchedulerStepState[]
): SchedulerStepState[] {
  const planNodeIds = new Set(plan.nodes.map((node) => node.id));
  const parentsByNodeId = createParentNodeMap(plan);
  const stepsByPlanNodeId = createStepMap(steps);

  return steps.filter(
    (step) =>
      step.status === "ready" &&
      dependenciesCompleted(
        step.planNodeId,
        planNodeIds,
        parentsByNodeId,
        stepsByPlanNodeId
      )
  );
}

export function listNewlyReadySteps(
  plan: PlanGraph,
  steps: SchedulerStepState[],
  completedStepId: string
): SchedulerStepState[] {
  const planNodeIds = new Set(plan.nodes.map((node) => node.id));
  const completedStep = steps.find((step) => step.id === completedStepId);

  if (
    !completedStep ||
    completedStep.status !== "completed" ||
    !planNodeIds.has(completedStep.planNodeId)
  ) {
    return [];
  }

  const parentsByNodeId = createParentNodeMap(plan);
  const childrenByNodeId = createChildNodeMap(plan);
  const stepsByPlanNodeId = createStepMap(steps);
  const dependentNodeIds = childrenByNodeId.get(completedStep.planNodeId) ?? [];

  return dependentNodeIds
    .map((planNodeId) => stepsByPlanNodeId.get(planNodeId))
    .filter((step): step is SchedulerStepState => {
      if (!step || step.status !== "pending") {
        return false;
      }

      return dependenciesCompleted(
        step.planNodeId,
        planNodeIds,
        parentsByNodeId,
        stepsByPlanNodeId
      );
    });
}

export function isRunTerminal(steps: SchedulerStepState[]): boolean {
  return steps.length > 0 && steps.every((step) => terminalStatuses.has(step.status));
}
