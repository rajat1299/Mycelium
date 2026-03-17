import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { createInMemoryServiceContainer } from "../src/lib/service-container";

const appsToClose = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    Array.from(appsToClose).map(async (app) => {
      appsToClose.delete(app);
      await app.close();
    })
  );
});

function daemonHeaders(token = "test-daemon-token") {
  return {
    "content-type": "application/json",
    "x-mycelium-daemon-token": token
  };
}

describe("worker status routes", () => {
  it("lists current worker status and marks stale workers offline for the operator surface", async () => {
    let now = new Date("2026-03-16T10:00:00.000Z");
    const services = createInMemoryServiceContainer({
      now: () => new Date(now)
    });
    const app = buildApp({ services });
    appsToClose.add(app);

    await app.inject({
      method: "POST",
      url: "/api/worker-daemon/register",
      headers: daemonHeaders(),
      payload: {
        workerId: "worker_1",
        workerSessionId: "worker_session_1",
        workspaceId: "ws_default",
        label: "Primary remote worker",
        daemonVersion: "1.0.0",
        connectedAt: "2026-03-16T10:00:00.000Z",
        capabilities: {
          capabilityFamilies: ["coding", "terminal"],
          supportsArtifacts: true,
          supportsCheckpoints: true,
          supportsLogs: true
        }
      }
    });

    const active = await app.inject({
      method: "GET",
      url: "/api/workers?workspaceId=ws_default"
    });

    expect(active.statusCode).toBe(200);
    expect(active.json()).toEqual({
      workers: [
        expect.objectContaining({
          id: "worker_1",
          sessionId: "worker_session_1",
          availability: "available",
          health: expect.objectContaining({
            status: "healthy"
          })
        })
      ]
    });

    now = new Date("2026-03-16T10:10:00.000Z");

    const stale = await app.inject({
      method: "GET",
      url: "/api/workers?workspaceId=ws_default"
    });

    expect(stale.statusCode).toBe(200);
    expect(stale.json()).toEqual({
      workers: [
        expect.objectContaining({
          id: "worker_1",
          availability: "offline",
          disconnectedAt: "2026-03-16T10:10:00.000Z",
          health: expect.objectContaining({
            status: "offline"
          })
        })
      ]
    });
  });
});
