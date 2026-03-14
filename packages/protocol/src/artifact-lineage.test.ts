import { describe, expect, it } from "vitest";
import {
  ArtifactLineageEdgeSchema,
  ArtifactLineageListResponseSchema
} from "./index";

describe("artifact lineage protocols", () => {
  it("accepts a valid artifact-lineage edge payload", () => {
    const edge = ArtifactLineageEdgeSchema.parse({
      id: "lineage_123",
      runId: "run_123",
      parentArtifactId: "artifact_parent",
      childArtifactId: "artifact_child",
      parentStepId: "step_parent",
      childStepId: "step_child",
      relation: "derived_from",
      createdAt: "2026-03-14T12:00:00.000Z"
    });

    expect(edge).toEqual(
      expect.objectContaining({
        relation: "derived_from"
      })
    );

    expect(
      ArtifactLineageListResponseSchema.parse({
        edges: [edge]
      })
    ).toEqual({
      edges: [edge]
    });
  });

  it("rejects self-referential lineage edges", () => {
    expect(() =>
      ArtifactLineageEdgeSchema.parse({
        id: "lineage_123",
        runId: "run_123",
        parentArtifactId: "artifact_same",
        childArtifactId: "artifact_same",
        parentStepId: "step_parent",
        childStepId: "step_child",
        relation: "derived_from",
        createdAt: "2026-03-14T12:00:00.000Z"
      })
    ).toThrow(/must connect two distinct artifacts/i);
  });
});
