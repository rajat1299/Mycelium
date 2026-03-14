import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";
import type { StoredWorkspaceCredential } from "@computer-oss/db";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_BYTES = 16;
const NONCE_BYTES = 12;
const CURRENT_SECRET_VERSION = 1;

export class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionConfigError";
  }
}

export type EncryptionService = {
  encryptSecret(secret: string): {
    secretCiphertext: string;
    secretNonce: string;
    secretVersion: number;
  };
  decryptSecret(credential: Pick<
    StoredWorkspaceCredential,
    "secretCiphertext" | "secretNonce" | "secretVersion"
  >): string;
};

function invalidKeyError() {
  return new EncryptionConfigError(
    "MYCELIUM_ENCRYPTION_KEY is invalid. Expected 32 bytes in raw, hex, or base64 form."
  );
}

function missingKeyError() {
  return new EncryptionConfigError(
    "MYCELIUM_ENCRYPTION_KEY is required for credential writes."
  );
}

function resolveEncryptionKey(rawKey?: string): Buffer | null {
  const trimmed = rawKey?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");

    if (decoded.length === 32 && decoded.toString("base64") === trimmed) {
      return decoded;
    }
  } catch {
    // Fall through to UTF-8 handling.
  }

  const utf8 = Buffer.from(trimmed, "utf8");

  if (utf8.length === 32) {
    return utf8;
  }

  throw invalidKeyError();
}

export function createEncryptionService(rawKey?: string): EncryptionService {
  const resolvedKey = resolveEncryptionKey(rawKey);

  function requireKey() {
    if (!resolvedKey) {
      throw missingKeyError();
    }

    return resolvedKey;
  }

  return {
    encryptSecret(secret) {
      const key = requireKey();
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, nonce);
      const encrypted = Buffer.concat([
        cipher.update(secret, "utf8"),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      return {
        secretCiphertext: Buffer.concat([authTag, encrypted]).toString("base64"),
        secretNonce: nonce.toString("base64"),
        secretVersion: CURRENT_SECRET_VERSION
      };
    },
    decryptSecret(credential) {
      const key = requireKey();

      if (credential.secretVersion !== CURRENT_SECRET_VERSION) {
        throw new EncryptionConfigError(
          `Unsupported credential secret version ${credential.secretVersion}.`
        );
      }

      const nonce = Buffer.from(credential.secretNonce, "base64");
      const payload = Buffer.from(credential.secretCiphertext, "base64");
      const authTag = payload.subarray(0, AUTH_TAG_BYTES);
      const encrypted = payload.subarray(AUTH_TAG_BYTES);

      if (nonce.length !== NONCE_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new EncryptionConfigError("Stored credential secret is invalid.");
      }

      try {
        const decipher = createDecipheriv(ALGORITHM, key, nonce);
        decipher.setAuthTag(authTag);

        return Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ]).toString("utf8");
      } catch {
        throw new EncryptionConfigError("Stored credential secret could not be decrypted.");
      }
    }
  };
}
