import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { WorkspaceLease, WorkspacePaths } from "./provider";

export interface WorkspaceManagerOptions {
  rootPath: string;
  now?: () => Date;
}

export class WorkspaceManager {
  private readonly rootPath: string;
  private readonly leases = new Set<string>();
  private readonly now: () => Date;

  constructor(options: WorkspaceManagerOptions) {
    this.rootPath = resolve(options.rootPath);
    this.now = options.now ?? (() => new Date());
  }

  getPaths(runId: string): WorkspacePaths {
    const workspaceRoot = join(this.rootPath, createWorkspaceDirectoryName(runId));

    return {
      rootPath: workspaceRoot,
      inputPath: join(workspaceRoot, "input"),
      artifactsPath: join(workspaceRoot, "artifacts"),
      logsPath: join(workspaceRoot, "logs")
    };
  }

  async acquire(runId: string): Promise<WorkspaceLease> {
    if (this.leases.has(runId)) {
      throw new Error(`Workspace already leased for run ${runId}`);
    }

    const paths = this.getPaths(runId);

    await Promise.all([
      mkdir(paths.inputPath, { recursive: true }),
      mkdir(paths.artifactsPath, { recursive: true }),
      mkdir(paths.logsPath, { recursive: true })
    ]);

    this.leases.add(runId);

    return {
      runId,
      acquiredAt: this.now().toISOString(),
      paths
    };
  }

  release(runId: string): void {
    this.leases.delete(runId);
  }

  isLeased(runId: string): boolean {
    return this.leases.has(runId);
  }
}

function createWorkspaceDirectoryName(runId: string): string {
  const slug = sanitizeSegment(runId);
  const hash = createHash("sha256").update(runId).digest("hex").slice(0, 12);
  return `${slug}-${hash}`;
}

function sanitizeSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "run";
}
