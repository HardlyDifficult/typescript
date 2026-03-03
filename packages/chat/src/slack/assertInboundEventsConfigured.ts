/** Ensure inbound event subscriptions are only used when receiver mode is enabled. */
export function assertInboundEventsConfigured(
  supportsInboundEvents: boolean
): void {
  if (supportsInboundEvents) {
    return;
  }
  throw new Error(
    "Slack inbound events are disabled. Configure socketMode=true with appToken, or set signingSecret for HTTP receiver mode."
  );
}
