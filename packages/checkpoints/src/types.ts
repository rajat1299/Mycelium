import type { CheckpointDetailPayload } from "@computer-oss/protocol";

export type CheckpointStoreWriteInput = {
  runId: string;
  checkpointId: string;
  sequence: number;
  manifest: CheckpointDetailPayload;
};

export type CheckpointStoreWriteResult = {
  storeKey: string;
  checksum: string;
  byteSize: number;
};

export type CheckpointStoreReadResult = CheckpointStoreWriteResult & {
  manifest: CheckpointDetailPayload;
};

export interface CheckpointStore {
  writeCheckpoint(
    input: CheckpointStoreWriteInput
  ): Promise<CheckpointStoreWriteResult>;
  readCheckpoint(storeKey: string): Promise<CheckpointStoreReadResult>;
  deleteCheckpoint(storeKey: string): Promise<void>;
}
