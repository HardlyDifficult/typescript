import type { Platform, ThreadData } from "./types";

/**
 * Represents a thread with deletion capability
 */
export class Thread {
  public readonly id: string;
  public readonly channelId: string;
  public readonly platform: Platform;

  private deleteOp: () => Promise<void>;

  constructor(data: ThreadData, deleteOp: () => Promise<void>) {
    this.id = data.id;
    this.channelId = data.channelId;
    this.platform = data.platform;
    this.deleteOp = deleteOp;
  }

  /**
   * Delete this thread
   */
  async delete(): Promise<void> {
    await this.deleteOp();
  }
}
