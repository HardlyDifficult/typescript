# @hardlydifficult/chat

Unified API for Discord and Slack messaging with rich document support.

## Installation

```bash
npm install @hardlydifficult/chat
```

## Quick Start

```typescript
import { createChatClient } from "@hardlydifficult/chat";

const client = createChatClient({ type: "discord" });
const channel = await client.connect(channelId);

// Post messages
await channel.postMessage("Hello!");

// Listen for incoming messages
channel.onMessage((event) => {
  console.log(`${event.author.username}: ${event.content}`);
});
```

## Configuration

```typescript
// Discord - env vars: DISCORD_TOKEN, DISCORD_GUILD_ID
createChatClient({ type: "discord" });
createChatClient({ type: "discord", token: "...", guildId: "..." });

// Slack - env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN
createChatClient({ type: "slack" });
createChatClient({ type: "slack", token: "...", appToken: "..." });
```

## Incoming Messages

Subscribe to new messages in a channel. Returns an unsubscribe function.

```typescript
const unsubscribe = channel.onMessage((event) => {
  // event.id, event.content, event.author, event.channelId, event.timestamp
  console.log(`${event.author.username}: ${event.content}`);
});

// Later: stop listening
unsubscribe();
```

Messages from the bot itself are automatically filtered out.

## Posting Messages

Content can be a string or a `Document` from `@hardlydifficult/document-generator`.

```typescript
// Simple text
channel.postMessage("Hello!");

// Rich document (auto-converted to Discord Embed / Slack Block Kit)
import { Document } from "@hardlydifficult/document-generator";

const report = new Document()
  .header("Daily Report")
  .text("Here are today's **highlights**:")
  .list(["Feature A completed", "Bug B fixed", "99.9% uptime"]);

channel.postMessage(report);
```

### File Attachments

Send files as message attachments.

```typescript
channel.postMessage("Here's the scan report", {
  files: [
    { content: Buffer.from(markdownContent), name: "report.md" },
    { content: "plain text content", name: "notes.txt" },
  ],
});
```

## Message Operations

```typescript
const msg = await channel.postMessage("Hello").wait();

await msg.update("Updated content");
await msg.delete();
msg.postReply("Thread reply");
```

### Reactions

```typescript
await channel
  .postMessage("Pick one")
  .addReactions(["👍", "👎"])
  .onReaction((event) => {
    console.log(`${event.user.username} reacted with ${event.emoji}`);
  });

msg.offReaction(); // stop listening
```

### Threads

Create a thread from an existing message.

```typescript
const msg = await channel.postMessage("Starting a discussion").wait();
const thread = await msg.startThread("Discussion Thread", {
  autoArchiveDuration: 1440, // minutes
});
```

> **Slack note:** Slack threads are implicit — calling `startThread()` returns the message's timestamp as the thread ID. Post replies with `msg.postReply()` to populate the thread.

## Typing Indicator

Show a "typing" indicator while processing.

```typescript
await channel.sendTyping();
// ... do work ...
await channel.postMessage("Done!");
```

> **Slack note:** Slack does not support bot typing indicators. `sendTyping()` is a no-op on Slack.

## Bulk Operations

Delete messages and manage threads in bulk.

```typescript
// Delete up to 100 recent messages
const deletedCount = await channel.bulkDelete(50);

// Get all threads (active and archived)
const threads = await channel.getThreads();
for (const thread of threads) {
  console.log(thread.id);
}
```

> **Slack note:** Slack has no bulk delete API — messages are deleted one-by-one. Some may fail if the bot lacks permission to delete others' messages. `getThreads()` scans recent channel history for messages with replies.

## Connection Resilience

Register callbacks for disconnect and error events. Discord includes built-in auto-reconnect with exponential backoff.

```typescript
const client = createChatClient({ type: "discord" });

client.onDisconnect((reason) => {
  console.log("Disconnected:", reason);
});

client.onError((error) => {
  console.error("Connection error:", error);
});

await client.disconnect(); // clean shutdown
```

Both callbacks return an unsubscribe function.

## Platform Setup

### Discord

1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable Gateway Intents: `GUILDS`, `GUILD_MESSAGES`, `GUILD_MESSAGE_REACTIONS`, `MESSAGE_CONTENT`
3. Bot permissions: `Send Messages`, `Add Reactions`, `Read Message History`, `Manage Messages` (for bulk delete), `Create Public Threads`, `Send Messages in Threads`
4. Set `DISCORD_TOKEN` and `DISCORD_GUILD_ID` env vars

### Slack

1. Create app at [Slack API](https://api.slack.com/apps)
2. Enable Socket Mode, generate App Token
3. Bot scopes: `chat:write`, `chat:write.public`, `reactions:write`, `reactions:read`, `channels:history`, `files:write`
4. Subscribe to events: `reaction_added`, `message.channels`
5. Set `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` env vars

## Platform Differences

| Feature | Discord | Slack |
|---|---|---|
| Incoming messages | Full support | Full support |
| Typing indicator | Full support | No-op (unsupported by Slack bot API) |
| File attachments | `AttachmentBuilder` | `filesUploadV2` |
| Thread creation | Creates named thread on message | Returns message timestamp (threads are implicit) |
| Bulk delete | Native `bulkDelete` API (fast) | One-by-one deletion (slower, may partially fail) |
| Get threads | `fetchActive` + `fetchArchived` | Scans channel history for threaded messages |
| Auto-reconnect | Built-in with exponential backoff | Handled by `@slack/bolt` Socket Mode |
