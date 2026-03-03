/** Receiver implementation used for outbound-only Slack API usage. */
export class NoReceiver {
  private static noop(): void {
    void 0;
  }

  init(): void {
    NoReceiver.noop();
  }

  start(): Promise<void> {
    NoReceiver.noop();
    return Promise.resolve();
  }

  stop(): Promise<void> {
    NoReceiver.noop();
    return Promise.resolve();
  }
}
