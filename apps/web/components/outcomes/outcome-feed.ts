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
  thread?: {
    plans: Plan[];
    runs: RunDetail[];
  };
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

export type OutcomeThreadTurn = {
  key: string;
  triggerMessageId: string | null;
  promptItem: Extract<OutcomeFeedItem, { type: "prompt" }> | null;
  messageItem: Extract<OutcomeFeedItem, { type: "message" }> | null;
  leadItem:
    | Extract<OutcomeFeedItem, { type: "intent" }>
    | Extract<OutcomeFeedItem, { type: "assistant-message" }>
    | null;
  planItems: Array<Extract<OutcomeFeedItem, { type: "plan" }>>;
  bodyItems: Array<
    Exclude<OutcomeFeedItem, { type: "prompt" | "plan" | "loading" }>
  >;
  loadingItem: Extract<OutcomeFeedItem, { type: "loading" }> | null;
  runIds: string[];
  planIds: string[];
};

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

function sortPlansInternal(plans: Plan[]) {
  return [...plans].sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    const updatedDelta = left.updatedAt.localeCompare(right.updatedAt);

    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortRunsInternal(runs: RunDetail[]) {
  return [...runs].sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    const updatedDelta = left.updatedAt.localeCompare(right.updatedAt);

    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return left.id.localeCompare(right.id);
  });
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
  initialMessages: MessageCreatedData[],
  initialPendingApprovals: Approval[]
): OutcomeConversationState {
  return {
    plan: initialPlan,
    run: initialRun,
    artifacts: sortArtifactsInternal(initialArtifacts),
    logs: sortLogsInternal(initialLogs),
    pendingApprovals: initialPendingApprovals,
    messages: sortMessagesInternal(initialMessages),
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

function buildPlanBlock(
  plan: Plan,
  run: RunDetail | null
): Extract<OutcomeFeedItem, { type: "plan" }> {
  const stepLookup = new Map((run?.steps ?? []).map((step) => [step.planNodeId, step]));
  const nodes = plan.nodes.slice().sort((left, right) => left.position - right.position);
  const completedCount = nodes.filter((node) =>
    stepLookup.get(node.id)?.status === "completed"
  ).length;
  const allDone = completedCount === nodes.length && nodes.length > 0;
  const title = allDone
    ? `All ${nodes.length} steps complete`
    : completedCount > 0
      ? `${completedCount} of ${nodes.length} steps complete`
      : run?.status === "running"
        ? `${nodes.length} steps ready to execute`
        : `${nodes.length} steps planned`;

  return {
    type: "plan",
    key: `plan:${plan.id}`,
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

function shouldRenderStepCard(step: RunStep) {
  return !["pending", "ready"].includes(step.status);
}

function buildMessageItem(
  message: MessageCreatedData
): Extract<OutcomeFeedItem, { type: "message" }> {
  return {
    type: "message",
    key: `msg:${message.id}`,
    message
  };
}

function resolveThreadPlans(state: OutcomeConversationState) {
  const plans = state.thread ? [...state.thread.plans] : [];

  if (state.plan && !plans.some((plan) => plan.id === state.plan?.id)) {
    plans.push(state.plan);
  }

  return sortPlansInternal(plans);
}

function resolveThreadRuns(state: OutcomeConversationState) {
  const runs = state.thread ? [...state.thread.runs] : [];

  if (state.run && !runs.some((run) => run.id === state.run?.id)) {
    runs.push(state.run);
  }

  return sortRunsInternal(runs);
}

function resolvePromptTriggerMessage(
  orderedUserMessages: MessageCreatedData[],
  threadPlans: Plan[],
  threadRuns: RunDetail[],
  state: OutcomeConversationState,
  outcomePrompt: string
) {
  if (state.thread) {
    const initialThreadTriggerMessageId =
      sortPlansInternal(threadPlans)[0]?.triggerMessageId ??
      sortRunsInternal(threadRuns)[0]?.triggerMessageId ??
      orderedUserMessages[0]?.id ??
      null;

    if (!initialThreadTriggerMessageId) {
      return null;
    }

    return (
      orderedUserMessages.find(
        (message) => message.id === initialThreadTriggerMessageId
      ) ?? null
    );
  }

  if (orderedUserMessages.length !== 1) {
    return null;
  }

  return orderedUserMessages[0]?.content === outcomePrompt
    ? orderedUserMessages[0]
    : null;
}

function selectRunForPlan(plan: Plan, runs: RunDetail[]) {
  return (
    sortRunsInternal(
      runs.filter(
        (run) =>
          run.planId === plan.id || run.triggerMessageId === plan.triggerMessageId
      )
    ).at(-1) ?? null
  );
}

function findTurnKeyForMessage(
  userMessageIds: Set<string>,
  triggerMessageId: string
) {
  return userMessageIds.has(triggerMessageId)
    ? `turn:${triggerMessageId}`
    : "turn:prompt";
}

type TurnSeed = {
  key: string;
  triggerMessageId: string | null;
  promptItem: Extract<OutcomeFeedItem, { type: "prompt" }> | null;
  messageItem: Extract<OutcomeFeedItem, { type: "message" }> | null;
  timestamp: string | null;
  plans: Plan[];
  runs: RunDetail[];
  additionalMessages: MessageCreatedData[];
};

export function buildOutcomeThreadTurns({
  outcomePrompt,
  outcomeSource,
  state
}: OutcomeFeedInput): OutcomeThreadTurn[] {
  const orderedMessages = sortMessagesInternal(state.messages);
  const orderedUserMessages = orderedMessages.filter((message) => message.role === "user");
  const threadPlans = resolveThreadPlans(state);
  const threadRuns = resolveThreadRuns(state);
  const promptTriggerMessage = resolvePromptTriggerMessage(
    orderedUserMessages,
    threadPlans,
    threadRuns,
    state,
    outcomePrompt
  );
  const followUpUserMessages = orderedUserMessages.filter(
    (message) => message.id !== promptTriggerMessage?.id
  );
  const nonUserMessages = orderedMessages.filter((message) => message.role !== "user");
  const userMessageIds = new Set(followUpUserMessages.map((message) => message.id));
  const turns = new Map<string, TurnSeed>();

  const promptTurn: TurnSeed = {
    key: "turn:prompt",
    triggerMessageId: promptTriggerMessage?.id ?? null,
    promptItem: {
      type: "prompt",
      key: "prompt",
      prompt: outcomePrompt
    },
    messageItem: null,
    timestamp: null,
    plans: [],
    runs: [],
    additionalMessages: []
  };

  turns.set(promptTurn.key, promptTurn);

  for (const message of followUpUserMessages) {
    turns.set(`turn:${message.id}`, {
      key: `turn:${message.id}`,
      triggerMessageId: message.id,
      promptItem: null,
      messageItem: buildMessageItem(message),
      timestamp: message.createdAt,
      plans: [],
      runs: [],
      additionalMessages: []
    });
  }

  for (const plan of threadPlans) {
    turns.get(findTurnKeyForMessage(userMessageIds, plan.triggerMessageId))?.plans.push(plan);
  }

  for (const run of threadRuns) {
    turns.get(findTurnKeyForMessage(userMessageIds, run.triggerMessageId))?.runs.push(run);
  }

  const orderedTurnSeeds = [
    promptTurn,
    ...followUpUserMessages
      .map((message) => turns.get(`turn:${message.id}`))
      .filter((turn): turn is TurnSeed => Boolean(turn))
  ];

  for (const message of nonUserMessages) {
    let targetTurn = promptTurn;

    for (const turn of orderedTurnSeeds.slice(1)) {
      if (turn.timestamp && turn.timestamp.localeCompare(message.createdAt) <= 0) {
        targetTurn = turn;
        continue;
      }

      break;
    }

    targetTurn.additionalMessages.push(message);
  }

  return orderedTurnSeeds.map((turn) => {
    const turnRuns = sortRunsInternal(turn.runs);
    const turnPlans = sortPlansInternal(turn.plans);
    const runIds = new Set(turnRuns.map((run) => run.id));
    const turnLogs = sortLogsInternal(state.logs.filter((log) => runIds.has(log.runId)));
    const systemLogs = turnLogs.filter((log) => !log.stepId);
    const promotedIntentLogs = collectPromotedIntentLogs(systemLogs);
    const visibleAssistantMessages = sortAssistantMessagesInternal(
      state.assistantMessages.filter(
        (message) => runIds.has(message.runId) && message.content.length > 0
      )
    );
    const leadAssistantMessage = visibleAssistantMessages[0] ?? null;
    const trailingAssistantMessages = visibleAssistantMessages.slice(1);
    const primaryIntentLog = promotedIntentLogs[0] ?? null;
    const primaryRun = turnRuns.at(-1) ?? null;
    const syntheticFallbackIntro =
      !leadAssistantMessage &&
      !primaryIntentLog &&
      (turn.promptItem !== null || turnPlans.length > 0 || turnRuns.length > 0)
        ? fallbackIntroMessage(outcomeSource, primaryRun)
        : null;

    const leadItem = leadAssistantMessage
      ? {
          type: "assistant-message" as const,
          key: `assistant-message:${leadAssistantMessage.id}`,
          message: leadAssistantMessage
        }
      : primaryIntentLog
        ? {
            type: "intent" as const,
            key: `intent:${logKey(primaryIntentLog)}`,
            message: primaryIntentLog.message
          }
        : syntheticFallbackIntro
          ? {
              type: "intent" as const,
              key: `intent:fallback:${turn.key}:${primaryRun?.status ?? "idle"}`,
              message: syntheticFallbackIntro
            }
          : null;

    const turnSteps = sortSteps(turnRuns.flatMap((run) => run.steps));
    const stepCards = turnSteps
      .filter((step) => shouldRenderStepCard(step))
      .map((step) => buildStepCardData(step, turnLogs, state.artifacts));
    const stepsById = new Map(turnSteps.map((step) => [step.id, step]));
    const turnArtifacts = sortArtifactsInternal(
      state.artifacts.filter(
        (artifact) =>
          (artifact.runId ? runIds.has(artifact.runId) : turn.key === promptTurn.key)
      )
    );
    const promotedDeliveryIds = promotedDeliveryArtifactIds(turnSteps, turnArtifacts);
    const hasAssistantDeliveryNarrative = visibleAssistantMessages.some(
      (message) => message.kind === "delivery"
    );

    type ChronoEntry = {
      timestamp: string;
      order: number;
      item: Exclude<OutcomeFeedItem, { type: "prompt" | "plan" | "loading" }>;
    };

    const chronoEntries: ChronoEntry[] = [];

    if (!leadAssistantMessage) {
      for (const intentLog of primaryIntentLog ? promotedIntentLogs.slice(1) : promotedIntentLogs) {
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

    for (const assistantMessage of trailingAssistantMessages) {
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

    for (const artifact of turnArtifacts) {
      if (!promotedDeliveryIds.has(artifact.id)) {
        continue;
      }

      chronoEntries.push({
        timestamp: artifact.createdAt,
        order: 30,
        item: buildArtifactDeliveryBlock(
          artifact,
          stepsById.get(artifact.stepId ?? "") ?? null
        )
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

    const runApprovals = [...state.pendingApprovals]
      .filter((approval) => runIds.has(approval.runId))
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));

    for (const approval of runApprovals) {
      chronoEntries.push({
        timestamp: approval.requestedAt,
        order: 40,
        item: {
          type: "approval",
          key: `approval:${approval.id}`,
          approval,
          artifacts: turnArtifacts.filter((artifact) =>
            approval.artifactIds.includes(artifact.id)
          )
        }
      });
    }

    for (const message of sortMessagesInternal(turn.additionalMessages)) {
      chronoEntries.push({
        timestamp: message.createdAt,
        order: 50,
        item: buildMessageItem(message)
      });
    }

    chronoEntries.sort((left, right) => {
      const timestampDelta = left.timestamp.localeCompare(right.timestamp);

      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return left.order - right.order;
    });

    return {
      key: turn.key,
      triggerMessageId: turn.triggerMessageId,
      promptItem: turn.promptItem,
      messageItem: turn.messageItem,
      leadItem,
      planItems: turnPlans.map((plan) =>
        buildPlanBlock(plan, selectRunForPlan(plan, turnRuns))
      ),
      bodyItems: chronoEntries.map((entry) => entry.item),
      loadingItem:
        primaryRun && stepCards.length === 0
          ? {
              type: "loading",
              key: `loading:${turn.key}`
            }
          : null,
      runIds: turnRuns.map((run) => run.id),
      planIds: turnPlans.map((plan) => plan.id)
    };
  });
}

export function buildOutcomeFeed(input: OutcomeFeedInput): OutcomeFeedItem[] {
  return buildOutcomeThreadTurns(input).flatMap((turn) => [
    ...(turn.promptItem ? [turn.promptItem] : []),
    ...(turn.messageItem ? [turn.messageItem] : []),
    ...(turn.leadItem ? [turn.leadItem] : []),
    ...turn.planItems,
    ...turn.bodyItems,
    ...(turn.loadingItem ? [turn.loadingItem] : [])
  ]);
}
