import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, posix, relative, resolve } from "node:path";

export interface LocalArtifactStoreOptions {
  rootPath: string;
}

export interface PutArtifactInput {
  relativePath: string;
  body: string | Uint8Array;
}

export interface StoredArtifact {
  relativePath: string;
  absolutePath: string;
  size: number;
}

export class LocalArtifactStore {
  private readonly rootPath: string;

  constructor(options: LocalArtifactStoreOptions) {
    this.rootPath = resolve(options.rootPath);
  }

  async put(input: PutArtifactInput): Promise<StoredArtifact> {
    const normalizedPath = normalizeRelativePath(input.relativePath);
    const absolutePath = resolveWithinRoot(this.rootPath, normalizedPath);
    const body =
      typeof input.body === "string" ? Buffer.from(input.body) : Buffer.from(input.body);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);

    return {
      relativePath: normalizedPath,
      absolutePath,
      size: body.byteLength
    };
  }

  async read(relativePath: string): Promise<Buffer> {
    const normalizedPath = normalizeRelativePath(relativePath);
    return await readFile(resolveWithinRoot(this.rootPath, normalizedPath));
  }

  async list(prefix = "."): Promise<StoredArtifact[]> {
    const normalizedPrefix = normalizeListPrefix(prefix);
    const searchRoot = resolveWithinRoot(this.rootPath, normalizedPrefix);

    try {
      return await listArtifacts(this.rootPath, searchRoot);
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return [];
      }

      throw error;
    }
  }
}

async function listArtifacts(rootPath: string, currentPath: string): Promise<StoredArtifact[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const artifacts: StoredArtifact[] = [];

  for (const entry of entries) {
    const entryPath = resolve(currentPath, entry.name);

    if (entry.isDirectory()) {
      artifacts.push(...(await listArtifacts(rootPath, entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const metadata = await stat(entryPath);
    artifacts.push({
      relativePath: relative(rootPath, entryPath).replace(/\\/g, "/"),
      absolutePath: entryPath,
      size: metadata.size
    });
  }

  return artifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function normalizeListPrefix(prefix: string): string {
  if (prefix === "." || prefix.length === 0) {
    return ".";
  }

  return normalizeRelativePath(prefix);
}

function normalizeRelativePath(relativePath: string): string {
  if (relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new Error("Artifact path must stay within the configured root");
  }

  const normalized = posix.normalize(relativePath.replace(/\\/g, "/"));
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error("Artifact path must stay within the configured root");
  }

  return normalized;
}

function resolveWithinRoot(rootPath: string, relativePath: string): string {
  const absolutePath = resolve(rootPath, relativePath);
  const relativeToRoot = relative(rootPath, absolutePath);

  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativeToRoot)
  ) {
    throw new Error("Artifact path must stay within the configured root");
  }

  return absolutePath;
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
