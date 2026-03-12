export interface WorkspacePaths {
  rootPath: string;
  inputPath: string;
  artifactsPath: string;
  logsPath: string;
}

export interface WorkspaceLease {
  runId: string;
  acquiredAt: string;
  paths: WorkspacePaths;
}

export interface SandboxExecutionContext {
  outcomeId: string;
  outcomePrompt: string;
}

export interface SandboxExecutionRequest {
  runId: string;
  step: SandboxExecutionStep;
  context: SandboxExecutionContext;
  workspace: WorkspacePaths;
  environment?: Record<string, string>;
  timeoutMs?: number;
}

export interface SandboxExecutionResult {
  containerName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  producedArtifactPaths: string[];
}

export interface SandboxProvider {
  execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult>;
}

export interface SandboxExecutionStep {
  id: string;
  runId: string;
  planNodeId: string;
  title: string;
  kind: string;
  capability: string;
  instruction?: string;
  template?: string;
  expectedArtifactPath?: string;
  expectedArtifactKind?: string;
  status: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DockerMount {
  source: string;
  target: string;
  readOnly: boolean;
}

export interface DockerRunRequest {
  image: string;
  name: string;
  remove: boolean;
  workdir: string;
  mounts: DockerMount[];
  environment: Record<string, string>;
  command: string[];
  timeoutMs?: number;
}

export interface DockerRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface DockerRunner {
  run(request: DockerRunRequest): Promise<DockerRunResult>;
}
