import { describe, expect, it } from "vitest";
import {
  LocalCompanionBootstrapSchema,
  LocalCompanionRegistrationSchema,
  LocalCompanionScopeSchema
} from "./index";

describe("local companion groundwork contracts", () => {
  it("accepts bootstrap, trust-establishment, capability, and scope payloads", () => {
    const scope = LocalCompanionScopeSchema.parse({
      pathScopes: [
        {
          rootPath: "/Users/rajattiwari/Documents",
          access: "read_write"
        },
        {
          rootPath: "/Applications",
          access: "read_only"
        }
      ],
      allowedCommands: ["git", "node", "pnpm"],
      allowedHosts: ["127.0.0.1", "localhost"]
    });

    const bootstrap = LocalCompanionBootstrapSchema.parse({
      companionId: "companion_1",
      workspaceId: "ws_default",
      sessionId: "companion_session_1",
      platform: "macos",
      controlPlaneUrl: "http://127.0.0.1:4000",
      transport: "loopback_https",
      trust: {
        mode: "bootstrap_token",
        bootstrapToken: "bootstrap_secret",
        tokenExpiresAt: "2026-03-17T13:00:00.000Z",
        requestedAt: "2026-03-17T12:00:00.000Z",
        expectedControlPlaneFingerprint: null
      },
      capabilities: {
        capabilities: ["filesystem", "terminal"],
        supportsInteractiveTerminal: true,
        supportsPrivilegedEscalation: false
      },
      scope
    });

    const registration = LocalCompanionRegistrationSchema.parse({
      companionId: bootstrap.companionId,
      sessionId: bootstrap.sessionId,
      workspaceId: bootstrap.workspaceId,
      platform: bootstrap.platform,
      version: "0.1.0",
      transport: bootstrap.transport,
      trust: bootstrap.trust,
      capabilities: bootstrap.capabilities,
      scope,
      connectedAt: "2026-03-17T12:00:05.000Z"
    });

    expect(registration.capabilities.capabilities).toContain("terminal");
    expect(registration.scope.pathScopes).toHaveLength(2);
  });
});
