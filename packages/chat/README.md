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
channel.onMessage((msg) => {
  console.log(`${msg.author.username}: ${msg.content}`);
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

### Oversized Message Handling

Messages that exceed platform limits (Discord: 2000 chars, Slack: 4000 chars) are handled automatically:

- **`postMessage`**: Sends the full content as a `message.txt` file attachment instead of failing
- **`update`**: Truncates with `…` (edits cannot attach files on either platform)

No caller changes needed — the library handles this transparently.

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
const msg = await channel.postMessage("Hello");

await msg.update("Updated content");
msg.reply("Thread reply");
await msg.delete();
```

### Reactions

```typescript
const msg = await channel
  .postMessage("Pick one")
  .addReactions(["👍", "👎"])
  .onReaction((event) => {
    console.log(`${event.user.username} reacted with ${event.emoji}`);
  });

msg.offReaction(); // stop listening

// Remove the bot's own reactions
msg.removeReactions(["👍", "👎"]);

// Remove all reactions from the message (from all users)
msg.removeAllReactions();
```

> **Slack note:** Slack only allows removing the bot's own reactions. `removeAllReactions()` removes the bot's reactions for every emoji on the message but cannot remove other users' reactions.

### Declarative Reactions

`setReactions` manages the full reaction state on a message. It diffs against the previous `setReactions` call, removing stale emojis and adding new ones, and replaces any existing reaction handler.

```typescript
const msg = await channel.postMessage("PR #42: open");

// Set initial reactions
msg.setReactions(["🟡"], (event) => handlePending(event));

// Later: update to merged state — removes 🟡, adds 🟢, swaps handler
msg.setReactions(["🟢"], (event) => handleMerged(event));
```

### Dismissable Messages

Post a message that the specified user can dismiss by clicking the trash reaction.

```typescript
await channel.postDismissable("Build complete!", user.id);
```

### Message Tracker

Track posted messages by key for later editing. Useful for status messages that should be updated in-place (e.g., "Worker disconnected" → "Worker reconnected").

```typescript
import { createMessageTracker } from "@hardlydifficult/chat";

const tracker = createMessageTracker((content) => channel.postMessage(content));

// Post and track by key
tracker.post("worker-1", "🔴 Worker disconnected: Server A");

// Later, edit the tracked message
const postedAt = tracker.getPostedAt("worker-1");
if (postedAt !== undefined) {
  const downtime = Date.now() - postedAt.getTime();
  tracker.edit("worker-1", `🟢 Worker reconnected: Server A (down for ${downtime}ms)`);
}
```

`post()` is fire-and-forget. `edit()` handles the race where the edit arrives before the original post completes — it chains on the stored promise.

### Threads

Create a thread, post messages, and listen for replies. The `Thread` object is the primary interface — all threading internals are hidden.

```typescript
// Create a thread (posts root message + starts thread)
const thread = await channel.createThread("Starting a session!", "Session");

// Post in the thread
const msg = await thread.post("How can I help?");

// Listen for replies
thread.onReply(async (msg) => {
  await thread.post(`Got: ${msg.content}`);
  // msg.reply() also posts in the same thread
  await msg.reply("Thanks!");
});

// Post with file attachments
await thread.post("Here's the report", [
  { content: "# Report\n...", name: "report.md" },
]);

// Stop listening and clean up
thread.offReply();
await thread.delete();
```

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

`msg.reply()` supports file attachments:

```typescript
const msg = await channel.postMessage("Processing...");
await msg.reply("Done!", [{ content: resultData, name: "result.json" }]);
```

> **Note:** `channel.onMessage()` only fires for top-level channel messages, not thread replies. Use `thread.onReply()` to listen for thread messages.

> **Slack note:** Slack threads are implicit — `createThread()` posts a root message and uses its timestamp as the thread ID.

### Streaming Replies

Buffer text and flush it as thread replies at a regular interval. Useful for commands that produce output over time (e.g., streaming CLI output). Long text is automatically chunked to fit within platform message limits.

```typescript
const msg = await channel.postMessage("Running...");
const stream = msg.streamReply(2000); // flush every 2s

stream.append("output line 1\n");
stream.append("output line 2\n");
// ... text is batched and sent as replies every 2 seconds

await stream.stop(); // flushes remaining text and stops the timer
```

`flush()` sends buffered text immediately without waiting for the next interval:

```typescript
stream.append("important output");
await stream.flush();
```

## Mentions

Get channel members and @mention them in messages.

```typescript
const members = await channel.getMembers();
const user = members.find((m) => m.username === "alice");
if (user) {
  await channel.postMessage(`Hey ${user.mention}, check this out!`);
}
```

Each `Member` has `id`, `username`, `displayName`, and `mention` (a ready-to-use `<@USER_ID>` string that renders as a clickable @mention on both platforms).

## Typing Indicator

Show a "typing" indicator while processing. `withTyping` sends the indicator immediately, refreshes it every 8 seconds, and cleans up automatically when the function completes.

```typescript
const result = await channel.withTyping(async () => {
  // typing indicator stays active during this work
  return await doExpensiveWork();
});
await channel.postMessage(result);
```

For one-shot use, `sendTyping()` sends a single indicator without automatic refresh:

```typescript
await channel.sendTyping();
```

> **Slack note:** Slack does not support bot typing indicators. Both methods are no-ops on Slack.

## Bulk Operations

Delete messages and manage threads in bulk.

```typescript
// Delete up to 100 recent messages
const deletedCount = await channel.bulkDelete(50);

// Get all threads (active and archived) and delete them
const threads = await channel.getThreads();
for (const thread of threads) {
  await thread.delete();
}
```

> **Slack note:** Slack has no bulk delete API — messages are deleted one-by-one. Some may fail if the bot lacks permission to delete others' messages. `getThreads()` scans recent channel history for messages with replies.

## Connection Resilience

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

## Platform Differences

| Feature           | Discord                                       | Slack                                            |
| ----------------- | --------------------------------------------- | ------------------------------------------------ |
| Message limit     | 2000 chars (auto-attaches as file if over)    | 4000 chars (auto-uploads as file if over)        |
| Incoming messages | Full support                                  | Full support                                     |
| Typing indicator  | Full support                                  | No-op (unsupported by Slack bot API)             |
| File attachments  | `AttachmentBuilder`                           | `filesUploadV2`                                  |
| Thread creation   | Creates named thread channel on message       | Returns message timestamp (threads are implicit) |
| Thread replies    | Messages arrive with `channelId = threadId`   | Messages arrive with `thread_ts` on parent channel |
| Bulk delete       | Native `bulkDelete` API (fast)                | One-by-one deletion (slower, may partially fail) |
| Get threads       | `fetchActive` + `fetchArchived`               | Scans channel history for threaded messages      |
| Delete thread     | `ThreadChannel.delete()`                      | Deletes parent message and all replies           |
| Get members       | Guild members filtered by channel permissions | `conversations.members` + `users.info`           |
| Auto-reconnect    | Handled by discord.js                         | Handled by `@slack/bolt` Socket Mode             |
