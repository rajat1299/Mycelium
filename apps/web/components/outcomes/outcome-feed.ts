import type {
  Approval,
  AssistantMessageCompletedData,
  AssistantMessageDeltaData,
  AssistantMessageSnapshot,
  AssistantMessageStartedData,
  Artifact,
  MessageCreatedData,
  OutcomeSource,
  Plan,
  RunDetail,
  RunLogData,
  RunStep
} from "@computer-oss/protocol";

export type OutcomeConversationState = {
  plan: Plan | null;
  run: RunDetail | null;
  artifacts: Artifact[];
  logs: RunLogData[];
  pendingApprovals: Approval[];
  messages: MessageCreatedData[];
  assistantMessages: AssistantNarrativeMessage[];
};

export type AssistantNarrativeMessage = AssistantMessageSnapshot;

export type StepCardData = {
  step: RunStep;
  latestLog: RunLogData | null;
  artifacts: Artifact[];
  primaryArtifact: Artifact | null;
  outputText: string | null;
};

export type ActionGroupItemData = {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
};

export type OutcomeFeedItem =
  | { type: "prompt"; key: string; prompt: string }
  | { type: "intent"; key: string; message: string }
  | { type: "assistant-message"; key: string; message: AssistantNarrativeMessage }
  | { type: "plan"; key: string; title: string; items: ActionGroupItemData[] }
  | { type: "task"; key: string; data: StepCardData }
  | {
      type: "artifact-delivery";
      key: string;
      artifact: Artifact;
      step: RunStep | null;
      title: string;
      summary: string | null;
      workspacePath: string;
    }
  | { type: "delivery-note"; key: string; message: string }
  | { type: "approval"; key: string; approval: Approval; artifacts: Artifact[] }
  | { type: "message"; key: string; message: MessageCreatedData }
  | { type: "loading"; key: string };

type OutcomeFeedInput = {
  outcomePrompt: string;
  outcomeSource: OutcomeSource;
  state: OutcomeConversationState;
};

function sortArtifactsInternal(artifacts: Artifact[]) {
  return [...artifacts].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

export function sortArtifacts(artifacts: Artifact[]) {
  return sortArtifactsInternal(artifacts);
}

export function upsertArtifact(artifacts: Artifact[], incoming: Artifact) {
  const next = artifacts.some((artifact) => artifact.id === incoming.id)
    ? artifacts.map((artifact) =>
        artifact.id === incoming.id ? incoming : artifact
      )
    : [...artifacts, incoming];
  return sortArtifactsInternal(next);
}

function sortLogsInternal(logs: RunLogData[]) {
  return [...logs].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

export function sortLogs(logs: RunLogData[]) {
  return sortLogsInternal(logs);
}

export function logKey(log: RunLogData) {
  return [log.runId, log.stepId ?? "run", log.createdAt, log.level, log.message].join(":");
}

export function appendLog(logs: RunLogData[], incoming: RunLogData) {
  if (logs.some((log) => logKey(log) === logKey(incoming))) {
    return sortLogsInternal(logs);
  }

  return sortLogsInternal([...logs, incoming]);
}

export function sortSteps(steps: RunStep[]) {
  return [...steps].sort((left, right) => left.position - right.position);
}

export function upsertStep(steps: RunStep[], incoming: RunStep) {
  const next = steps.some((step) => step.id === incoming.id)
    ? steps.map((step) => (step.id === incoming.id ? incoming : step))
    : [...steps, incoming];
  return sortSteps(next);
}

function sortMessagesInternal(messages: MessageCreatedData[]) {
  return [...messages].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

export function appendMessage(
  messages: MessageCreatedData[],
  incoming: MessageCreatedData
) {
  if (messages.some((message) => message.id === incoming.id)) {
    return sortMessagesInternal(messages);
  }

  return sortMessagesInternal([...messages, incoming]);
}

function sortAssistantMessagesInternal(messages: AssistantNarrativeMessage[]) {
  return [...messages].sort((left, right) => {
    const timestampDelta = left.createdAt.localeCompare(right.createdAt);

    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

export function startAssistantMessage(
  messages: AssistantNarrativeMessage[],
  incoming: AssistantMessageStartedData
) {
  const existing = messages.find((message) => message.id === incoming.messageId);

  if (existing) {
    return sortAssistantMessagesInternal(
      messages.map((message) =>
        message.id === incoming.messageId
          ? {
              ...message,
              runId: incoming.runId,
              kind: incoming.kind,
              createdAt: incoming.createdAt
            }
          : message
      )
    );
  }

  return sortAssistantMessagesInternal([
    ...messages,
    {
      id: incoming.messageId,
      runId: incoming.runId,
      kind: incoming.kind,
      content: "",
      createdAt: incoming.createdAt,
      updatedAt: incoming.createdAt,
      status: "streaming"
    }
  ]);
}

export function appendAssistantMessageDelta(
  messages: AssistantNarrativeMessage[],
  incoming: AssistantMessageDeltaData
) {
  const existing = messages.find((message) => message.id === incoming.messageId);

  if (!existing) {
    return sortAssistantMessagesInternal([
      ...messages,
      {
        id: incoming.messageId,
        runId: incoming.runId,
        kind: incoming.kind,
        content: incoming.content,
        createdAt: incoming.createdAt,
        updatedAt: incoming.updatedAt,
        status: "streaming"
      }
    ]);
  }

  return sortAssistantMessagesInternal(
    messages.map((message) =>
      message.id === incoming.messageId
        ? {
            ...message,
            runId: incoming.runId,
            kind: incoming.kind,
            content: incoming.content,
            updatedAt: incoming.updatedAt,
            status: message.status === "completed" ? "completed" : "streaming"
          }
        : message
    )
  );
}

export function completeAssistantMessage(
  messages: AssistantNarrativeMessage[],
  incoming: AssistantMessageCompletedData
) {
  const existing = messages.find((message) => message.id === incoming.messageId);

  if (!existing) {
    return sortAssistantMessagesInternal([
      ...messages,
      {
        id: incoming.messageId,
        runId: incoming.runId,
        kind: incoming.kind,
        content: incoming.content,
        createdAt: incoming.createdAt,
        updatedAt: incoming.completedAt,
        status: "completed"
      }
    ]);
  }

  return sortAssistantMessagesInternal(
    messages.map((message) =>
      message.id === incoming.messageId
        ? {
            ...message,
            runId: incoming.runId,
            kind: incoming.kind,
            content: incoming.content,
            updatedAt: incoming.completedAt,
            status: "completed"
          }
        : message
    )
  );
}

export function buildInitialOutcomeConversationState(
  initialPlan: Plan | null,
  initialRun: RunDetail | null,
  initialArtifacts: Artifact[],
  initialLogs: RunLogData[],
  initialAssistantMessages: AssistantNarrativeMessage[],
  initialPendingApprovals: Approval[]
): OutcomeConversationState {
  return {
    plan: initialPlan,
    run: initialRun,
    artifacts: sortArtifactsInternal(initialArtifacts),
    logs: sortLogsInternal(initialLogs),
    pendingApprovals: initialPendingApprovals,
    messages: [],
    assistantMessages: sortAssistantMessagesInternal(initialAssistantMessages)
  };
}

function fallbackIntroMessage(
  outcomeSource: OutcomeSource,
  run: RunDetail | null
) {
  void outcomeSource;

  if (!run) {
    return "I'll start by loading relevant context and shaping the work into focused subtasks.";
  }

  if (run.status === "completed") {
    return "The work is complete. The finished subtasks and final artifact are collected below.";
  }

  if (run.status === "failed") {
    return "The task stopped before it finished. The latest subtask states and failure context are shown below.";
  }

  return "I'll start by loading relevant context, then break the work into focused subtasks and run them through the task feed below.";
}

function lastLogForStep(logs: RunLogData[], stepId: string) {
  return [...logs].reverse().find((log) => log.stepId === stepId);
}

function artifactsForStep(artifacts: Artifact[], stepId: string) {
  return artifacts.filter((artifact) => artifact.stepId === stepId);
}

function readMetadataString(artifact: Artifact | null, key: string) {
  if (!artifact) {
    return null;
  }

  const value = artifact.metadata[key];
  return typeof value === "string" ? value : null;
}

export function formatByteSize(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}MB`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}KB`;
  }

  return `${value}B`;
}

export function displayWorkspacePath(relativePath: string) {
  const fileName = relativePath.split("/").filter(Boolean).at(-1) ?? relativePath;
  return `/home/user/workspace/${fileName}`;
}

export function buildStepCardData(
  step: RunStep,
  logs: RunLogData[],
  artifacts: Artifact[]
): StepCardData {
  const stepArtifacts = artifactsForStep(artifacts, step.id);
  const primaryArtifact = stepArtifacts.at(-1) ?? null;
  const previewBody = readMetadataString(primaryArtifact, "previewBody");
  const previewSummary = readMetadataString(primaryArtifact, "summary");
  const latestLog = lastLogForStep(logs, step.id) ?? null;
  const outputText = previewBody ?? previewSummary ?? latestLog?.message ?? null;

  return {
    step,
    latestLog,
    artifacts: stepArtifacts,
    primaryArtifact,
    outputText
  };
}

function normalizeStepStatus(status: string): ActionGroupItemData["status"] {
  if (status === "completed") {
    return "completed";
  }

  if (status === "running" || status === "claimed") {
    return "running";
  }

  if (status === "failed") {
    return "failed";
  }

  return "pending";
}

function isPromotedIntentMessage(message: string) {
  return /\b(load|start|starting|split|parallel|read|reading|compile|compiling|synthes|complete|completed|resume|resum|interrupt|blocked|approval|deliver|ready)\b/i.test(
    message
  );
}

function collectPromotedIntentLogs(systemLogs: RunLogData[]) {
  if (systemLogs.length === 0) {
    return [];
  }

  const promoted: RunLogData[] = [];

  for (const [index, log] of systemLogs.entries()) {
    if (index === 0 || isPromotedIntentMessage(log.message)) {
      const previous = promoted.at(-1);

      if (!previous || previous.message !== log.message) {
        promoted.push(log);
      }
    }
  }

  return promoted;
}

function buildPlanBlock(state: OutcomeConversationState): OutcomeFeedItem | null {
  if (!state.plan) {
    return null;
  }

  const stepLookup = new Map(
    (state.run?.steps ?? []).map((step) => [step.planNodeId, step])
  );
  const nodes = state.plan.nodes.slice().sort((left, right) => left.position - right.position);
  const completedCount = nodes.filter((node) =>
    stepLookup.get(node.id)?.status === "completed"
  ).length;
  const allDone = completedCount === nodes.length && nodes.length > 0;
  const title = allDone
    ? `All ${nodes.length} subtasks complete`
    : state.run?.status === "running"
      ? `Running ${nodes.length} subtasks`
      : `${nodes.length} subtasks planned`;

  return {
    type: "plan",
    key: "plan",
    title,
    items: nodes.map((node) => ({
      id: node.id,
      title: node.title,
      status: normalizeStepStatus(stepLookup.get(node.id)?.status ?? "pending")
    }))
  };
}

function promotedDeliveryArtifactIds(
  steps: RunStep[],
  artifacts: Artifact[]
) {
  const completedStepIds = new Set(
    steps.filter((step) => step.status === "completed").map((step) => step.id)
  );

  return new Set(
    artifacts
      .filter(
        (artifact) =>
          artifact.kind === "result" &&
          artifact.stepId !== null &&
          completedStepIds.has(artifact.stepId)
      )
      .map((artifact) => artifact.id)
  );
}

function buildArtifactDeliveryBlock(
  artifact: Artifact,
  step: RunStep | null
): Extract<OutcomeFeedItem, { type: "artifact-delivery" }> {
  const summary =
    typeof artifact.metadata.summary === "string"
      ? artifact.metadata.summary
      : typeof artifact.metadata.previewBody === "string"
        ? artifact.metadata.previewBody
        : null;

  return {
    type: "artifact-delivery",
    key: `delivery:${artifact.id}`,
    artifact,
    step,
    title: artifact.kind === "result" ? "Final result ready" : "Artifact delivered",
    summary,
    workspacePath: displayWorkspacePath(artifact.relativePath)
  };
}

function buildArtifactDeliveryNote(
  artifact: Artifact
): Extract<OutcomeFeedItem, { type: "delivery-note" }> | null {
  if (artifact.kind !== "result") {
    return null;
  }

  const message =
    typeof artifact.metadata.summary === "string"
      ? artifact.metadata.summary
      : typeof artifact.metadata.previewBody === "string"
        ? artifact.metadata.previewBody
        : null;

  if (!message) {
    return null;
  }

  return {
    type: "delivery-note",
    key: `delivery-note:${artifact.id}`,
    message
  };
}

export function buildOutcomeFeed({
  outcomePrompt,
  outcomeSource,
  state
}: OutcomeFeedInput): OutcomeFeedItem[] {
  const items: OutcomeFeedItem[] = [
    {
      type: "prompt",
      key: "prompt",
      prompt: outcomePrompt
    }
  ];

  const orderedLogs = sortLogsInternal(state.logs);
  const systemLogs = orderedLogs.filter((log) => !log.stepId);
  const promotedIntentLogs = collectPromotedIntentLogs(systemLogs);
  const visibleAssistantMessages = sortAssistantMessagesInternal(
    state.assistantMessages.filter((message) => message.content.length > 0)
  );
  const hasAssistantNarrative = visibleAssistantMessages.length > 0;

  if (!hasAssistantNarrative) {
    const primaryIntent =
      promotedIntentLogs[0]?.message ?? fallbackIntroMessage(outcomeSource, state.run);

    items.push({
      type: "intent",
      key: promotedIntentLogs[0]
        ? `intent:${logKey(promotedIntentLogs[0])}`
        : `intent:fallback:${state.run?.status ?? "idle"}`,
      message: primaryIntent
    });
  }

  const planBlock = buildPlanBlock(state);
  if (planBlock) {
    items.push(planBlock);
  }

  const orderedSteps = sortSteps(state.run?.steps ?? []);
  const stepCards = orderedSteps.map((step) =>
    buildStepCardData(step, state.logs, state.artifacts)
  );
  const stepsById = new Map(orderedSteps.map((step) => [step.id, step]));
  const promotedDeliveryIds = promotedDeliveryArtifactIds(orderedSteps, state.artifacts);
  const hasAssistantDeliveryNarrative = visibleAssistantMessages.some(
    (message) => message.kind === "delivery"
  );

  type ChronoEntry = {
    timestamp: string;
    order: number;
    item: Exclude<
      OutcomeFeedItem,
      { type: "prompt" | "plan" | "loading" }
    >;
  };

  const chronoEntries: ChronoEntry[] = [];

  if (!hasAssistantNarrative) {
    for (const intentLog of promotedIntentLogs.slice(1)) {
      chronoEntries.push({
        timestamp: intentLog.createdAt,
        order: 10,
        item: {
          type: "intent",
          key: `intent:${logKey(intentLog)}`,
          message: intentLog.message
        }
      });
    }
  }

  for (const assistantMessage of visibleAssistantMessages) {
    chronoEntries.push({
      timestamp: assistantMessage.createdAt,
      order: 15,
      item: {
        type: "assistant-message",
        key: `assistant-message:${assistantMessage.id}`,
        message: assistantMessage
      }
    });
  }

  for (const card of stepCards) {
    chronoEntries.push({
      timestamp: card.step.createdAt,
      order: 20,
      item: {
        type: "task",
        key: `step:${card.step.id}`,
        data: card
      }
    });
  }

  for (const artifact of sortArtifactsInternal(state.artifacts)) {
    if (!promotedDeliveryIds.has(artifact.id)) {
      continue;
    }

    chronoEntries.push({
      timestamp: artifact.createdAt,
      order: 30,
      item: buildArtifactDeliveryBlock(artifact, stepsById.get(artifact.stepId ?? "") ?? null)
    });

    const deliveryNote = hasAssistantDeliveryNarrative
      ? null
      : buildArtifactDeliveryNote(artifact);

    if (deliveryNote) {
      chronoEntries.push({
        timestamp: artifact.createdAt,
        order: 35,
        item: deliveryNote
      });
    }
  }

  const currentApproval = state.run
    ? (state.pendingApprovals.find((approval) => approval.runId === state.run?.id) ?? null)
    : null;

  if (currentApproval) {
    chronoEntries.push({
      timestamp: currentApproval.requestedAt,
      order: 40,
      item: {
        type: "approval",
        key: `approval:${currentApproval.id}`,
        approval: currentApproval,
        artifacts: state.artifacts.filter((artifact) =>
          currentApproval.artifactIds.includes(artifact.id)
        )
      }
    });
  }

  for (const message of sortMessagesInternal(state.messages)) {
    chronoEntries.push({
      timestamp: message.createdAt,
      order: 50,
      item: {
        type: "message",
        key: `msg:${message.id}`,
        message
      }
    });
  }

  chronoEntries.sort((left, right) => {
    const timestampDelta = left.timestamp.localeCompare(right.timestamp);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.order - right.order;
  });

  items.push(...chronoEntries.map((entry) => entry.item));

  if (state.run && stepCards.length === 0) {
    items.push({
      type: "loading",
      key: "loading"
    });
  }

  return items;
}
