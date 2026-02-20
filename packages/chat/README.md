# @hardlydifficult/chat

A unified API for Discord and Slack messaging with rich document support, threading, reactions, and bulk operations.

## Installation

```bash
npm install @hardlydifficult/chat
```

## Quick Start

```typescript
import { createChatClient } from "@hardlydifficult/chat";

// Connect to Discord or Slack
const client = createChatClient({ type: "discord" });
// or { type: "slack" }

const channel = await client.connect("channel-id");
await channel.postMessage("Hello world!").addReactions(["👍", "👎"]);
```

## Core Concepts

### Message Operations

Messages returned from `postMessage()` support chainable reaction and management operations.

```typescript
const msg = await channel
  .postMessage("Vote: 1, 2, or 3")
  .addReactions(["1️⃣", "2️⃣", "3️⃣"])
  .onReaction((event) => console.log(`${event.user.username} voted ${event.emoji}`));

await msg.update("Final count in thread...");
await msg.delete({ cascadeReplies: false });
```

#### Reply Messages

Replies can be awaited like promises and support reactions before resolution.

```typescript
const reply = await msg.reply("Counting votes...");
await reply.update("12 votes for pizza");
await reply.addReactions(["🎉"]);
await reply.waitForReactions();
```

### Streaming Replies

Stream text into threads with automatic batching, chunking, and platform limit handling.

```typescript
const stream = thread.stream(1000, abortSignal);
stream.append("Processing...\n");
stream.append("Result: 42\n");
await stream.stop();
```

#### Editable Stream

Updates a single message in-place instead of creating new messages.

```typescript
const editableStream = thread.editableStream(2000);
editableStream.append("Step 1...\n");
editableStream.append("Step 2...\n");
await editableStream.stop(); // posts one message, edits it twice
```

### Threads

Create and manage conversational threads anchored to messages.

```typescript
const thread = await channel.createThread("Topic", "Session-1");
await thread.post("How can I help?");
thread.onReply(async (msg) => {
  await thread.post(`You said: ${msg.content}`);
});
await thread.delete();
```

### Batching Messages

Group related messages with post-commit operations.

```typescript
const batch = await channel.beginBatch({ key: "report" });
await batch.post("Line 1");
await batch.post("Line 2");
await batch.finish();

await batch.deleteAll();
await batch.keepLatest(5);
```

#### With Batch Helper

Auto-finish batch even on errors.

```typescript
await channel.withBatch(async (batch) => {
  await batch.post("First");
  await batch.post("Second");
  throw new Error("boom"); // batch.finish() called in finally
});
```

### Typing Indicators

Show typing indicators for long-running work.

```typescript
channel.beginTyping();
try {
  await longRunningTask();
} finally {
  channel.endTyping();
}

await channel.withTyping(() => processMessages());
```

### Message Cleanup

Convenience methods for bulk message management.

```typescript
// Keep newest 10, delete rest
await channel.pruneMessages({ keep: 10 });

// Fetch bot's recent messages
const botMessages = await channel.getRecentBotMessages(50);
```

### Member Matching

Resolve users by mention, username, display name, or email.

```typescript
await channel.resolveMention("@nick"); // "<@U123>"
await channel.resolveMention("Nick Mancuso"); // "<@U123>"
await channel.resolveMention("nick@example.com"); // "<@U123>"

const member = await channel.findMember("nick");
```

### Message Tracker

Track messages by key for later editing.

```typescript
const tracker = createMessageTracker((content) => channel.postMessage(content));
tracker.post("status-worker-1", "🔴 Worker disconnected");
// Later:
tracker.edit("status-worker-1", "🟢 Worker reconnected");
```

## Command System

The built-in command framework supports auto-parsed arguments, typing indicators, and message cleanup.

```typescript
import { CommandRegistry, CommandDispatcher, setupJobLifecycle } from "@hardlydifficult/chat";

const registry = new CommandRegistry();

registry.register("tools", {
  prefix: "merge",
  description: "Merge pull requests",
  args: { type: "rest", argName: "query" },
  execute: async (ctx, args) => {
    const { thread, abortController } = setupJobLifecycle({
      originalMessage: ctx.incomingMessage,
      thread: await ctx.startThread("Merge"),
      abortController: new AbortController(),
      ownerUsername: ctx.incomingMessage.author?.username!,
    });

    // Use abortController.signal to support cancellation
    const result = await mergePRs(args.query, abortController.signal);
    await thread.post(result);
    thread.complete();
  },
});

const dispatcher = new CommandDispatcher({
  channel,
  registry,
  state: { inFlightCommands: new Set() },
});
channel.onMessage((msg) => dispatcher.handleMessage(msg));
```

## Platform Config

```typescript
// Discord
createChatClient({
  type: "discord",
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
});

// Slack
createChatClient({
  type: "slack",
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});
```

## Document Output

Convert structured documents to platform-native rich text.

```typescript
import { Document, header, text, list, divider, context } from "@hardlydifficult/document-generator";

const doc = new Document()
  .add(header("Status Report"))
  .add(divider())
  .add(text("All systems operational."))
  .add(list(["API: ✅", "DB: ✅", "Cache: ✅"]))
  .add(context("Generated at " + new Date().toISOString()));

await channel.postMessage(doc);
```

## Typing

All core types are exported for direct use.

```typescript
import type { Member, Message, Thread, MessageBatch } from "@hardlydifficult/chat";
```

## Appendix

### Platform Differences

| Feature                | Discord                           | Slack                             |
|------------------------|-----------------------------------|-----------------------------------|
| Typing indicators      | ✅ Supported                      | ❌ No API support (no-op)         |
| Message length limit   | 2000 characters                   | 4000 characters                   |
| Thread creation        | Explicit thread channel           | Implicit via parent message ts    |
| Bulk delete            | ✅ Up to 100 messages at once     | ❌ Must delete one-by-one         |
| Emoji format           | Plain Unicode or `:name:`         | Colon-wrapped `:name:`            |
| File uploads           | As attachments                    | Via `filesUploadV2` API           |

### Additional Features from Current README

#### Bot Identity

After `connect()`, `client.me` exposes the authenticated bot user:

```typescript
const client = createChatClient({ type: "slack" });
await client.connect(channelId);

console.log(client.me?.id); // "U09B00R2R96"
console.log(client.me?.username); // "sprint-bot"
console.log(client.me?.mention); // "<@U09B00R2R96>"
```

#### Incoming Messages

Subscribe to new messages in a channel. The callback receives a full `Message` object — you can delete it, react to it, or reply in its thread.

```typescript
const unsubscribe = channel.onMessage((msg) => {
  console.log(`${msg.author.username}: ${msg.content}`);

  // Delete the user's command message
  msg.delete();

  // React to it
  msg.addReactions(["white_check_mark"]);

  // Reply in the message's thread
  msg.reply("Got it!");
});

// Later: stop listening
unsubscribe();
```

Messages from the bot itself are automatically filtered out.

#### Oversized Message Handling

Messages that exceed platform limits (Discord: 2000 chars, Slack: 4000 chars) are handled automatically:

- **`postMessage`**: Sends the full content as a `message.txt` file attachment instead of failing
- **`update`**: Truncates with `…` (edits cannot attach files on either platform)

No caller changes needed — the library handles this transparently.

#### File Attachments

Send files as message attachments.

```typescript
channel.postMessage("Here's the scan report", {
  files: [
    { content: Buffer.from(markdownContent), name: "report.md" },
    { content: "plain text content", name: "notes.txt" },
  ],
});
```

#### Dismissable Messages

Post a message that the specified user can dismiss by clicking the trash reaction.

```typescript
await channel.postDismissable("Build complete!", user.id);
```

#### Declarative Reactions

`setReactions` manages the full reaction state on a message. It diffs against the previous `setReactions` call, removing stale emojis and adding new ones, and replaces any existing reaction handler.

```typescript
const msg = await channel.postMessage("PR #42: open");

// Set initial reactions
msg.setReactions(["🟡"], (event) => handlePending(event));

// Later: update to merged state — removes 🟡, adds 🟢, swaps handler
msg.setReactions(["🟢"], (event) => handleMerged(event));
```

#### Message Batches

Group related posted messages so they can be retrieved and cleaned up together.

```typescript
const batch = await channel.beginBatch({ key: "sprint-update" });

for (const member of members) {
  const msg = await batch.post(summary(member));
  await msg.reply(detail(member));
}

await batch.post(callouts);
await batch.finish();

const recent = await channel.getBatches({
  key: "sprint-update",
  author: "me",
  limit: 5,
});

await recent[0].deleteAll({ cascadeReplies: true });
```

For safer lifecycle handling, use `withBatch` (auto-finishes in `finally`):

```typescript
await channel.withBatch({ key: "sprint-update" }, async (batch) => {
  await batch.post("Part 1");
  await batch.post("Part 2");
});
```

#### Threads (Enhanced)

You can also create a thread from an existing message:

```typescript
const msg = await channel.postMessage("Starting a discussion");
const thread = await msg.startThread("Discussion Thread", 1440); // auto-archive in minutes
```

Reconnect to an existing thread by ID (e.g., after a restart):

```typescript
const thread = channel.openThread(savedThreadId);
await thread.post("I'm back!");
thread.onReply(async (msg) => { /* ... */ });
```

#### Streaming Replies (Enhanced)

Both `streamReply()`, `thread.stream()`, and `thread.editableStream()` accept an optional `AbortSignal` to automatically stop the stream on cancellation. After abort, `append()` becomes a no-op and `stop()` is called automatically.

```typescript
const controller = new AbortController();
const stream = thread.stream(2000, controller.signal);

stream.append("working...\n");
controller.abort(); // auto-stops, future appends are ignored
console.log(stream.content); // "working...\n" — only pre-abort text
```

#### Typing Indicator (Enhanced)

For one-shot use, `sendTyping()` sends a single indicator without automatic refresh:

```typescript
await channel.sendTyping();
```

> **Slack note:** Slack does not support bot typing indicators. Both methods are no-ops on Slack.

#### Bulk Operations (Enhanced)

```typescript
// Delete up to 100 recent messages
const deletedCount = await channel.bulkDelete(50);

// List and filter recent messages
const botMessages = await channel.getMessages({ limit: 50, author: "me" });
const sameMessages = await channel.getRecentBotMessages(50);

// Keep latest 8 bot messages, delete older ones (opinionated cleanup helper)
await channel.pruneMessages({ author: "me", limit: 50, keep: 8 });

// Get all threads (active and archived) and delete them
const threads = await channel.getThreads();
for (const thread of threads) {
  await thread.delete();
}
```

> **Slack note:** Slack has no bulk delete API — messages are deleted one-by-one. Some may fail if the bot lacks permission to delete others' messages. `getThreads()` scans recent channel history for messages with replies.

#### Connection Resilience

Both platforms auto-reconnect via their underlying libraries (discord.js and @slack/bolt). Register callbacks for observability.

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
2. Enable Gateway Intents: `GUILDS`, `GUILD_MEMBERS`, `GUILD_MESSAGES`, `GUILD_MESSAGE_REACTIONS`, `MESSAGE_CONTENT`
3. Bot permissions: `Send Messages`, `Add Reactions`, `Read Message History`, `Manage Messages` (for bulk delete), `Create Public Threads`, `Send Messages in Threads`
4. Set `DISCORD_TOKEN` and `DISCORD_GUILD_ID` env vars

### Slack

1. Create app at [Slack API](https://api.slack.com/apps)
2. Enable Socket Mode, generate App Token
3. Bot scopes: `chat:write`, `chat:write.public`, `reactions:write`, `reactions:read`, `channels:history`, `channels:read`, `files:write`, `users:read`
4. Subscribe to events: `reaction_added`, `message.channels`
5. Set `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` env vars