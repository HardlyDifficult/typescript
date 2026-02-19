I'll analyze the package structure and generate a comprehensive README. Let me start by examining the key source files.Now let me examine the core classes to understand their APIs:Now let me check the Thread, MessageBatch, and other key classes:Now let me check the EditableStreamReply and constants:Now let me check some test files to understand usage patterns better:Perfect! Now I have enough information to write a comprehensive README. Let me create it:

# @hardlydifficult/chat

Unified API for Discord and Slack messaging with rich document support, threading, reactions, and bulk operations.

## Installation

```bash
npm install @hardlydifficult/chat
```

## Quick Start

```typescript
import { createChatClient } from "@hardlydifficult/chat";

const client = createChatClient({ type: "discord" });
const channel = await client.connect(channelId);

// Post a message
const msg = await channel.postMessage("Hello!");

// Listen for incoming messages
channel.onMessage((msg) => {
  console.log(`${msg.author.username}: ${msg.content}`);
});
```

## Configuration

### Discord

```typescript
// Uses env vars: DISCORD_TOKEN, DISCORD_GUILD_ID
const client = createChatClient({ type: "discord" });

// Or pass explicitly
const client = createChatClient({
  type: "discord",
  token: "your-token",
  guildId: "your-guild-id",
});

const channel = await client.connect(channelId);
```

### Slack

```typescript
// Uses env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN
const client = createChatClient({ type: "slack" });

// Or pass explicitly
const client = createChatClient({
  type: "slack",
  token: "xoxb-...",
  appToken: "xapp-...",
});

const channel = await client.connect(channelId);
```

## API Reference

### createChatClient

Factory function to create a chat client for Discord or Slack.

```typescript
function createChatClient(config: ChatConfig): ChatClient;
```

**Parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `config.type` | `"discord" \| "slack"` | Platform type |
| `config.token?` | `string` | Bot token (defaults to env var) |
| `config.guildId?` | `string` | Discord guild ID (defaults to env var) |
| `config.appToken?` | `string` | Slack app token (defaults to env var) |

**Returns:** `ChatClient` instance

**Example:**

```typescript
const client = createChatClient({ type: "discord" });
const channel = await client.connect("123456789");
console.log(client.me?.mention); // "<@BOT_ID>"
```

### ChatClient

Abstract base class for chat platform clients. Provides connection management and bot identity.

#### Properties

**`me: ClientIdentity | null`**

The authenticated bot user. Available after `connect()` succeeds.

```typescript
const client = createChatClient({ type: "slack" });
await client.connect(channelId);

console.log(client.me?.id); // "U09B00R2R96"
console.log(client.me?.username); // "sprint-bot"
console.log(client.me?.displayName); // "Sprint Bot"
console.log(client.me?.mention); // "<@U09B00R2R96>"
```

#### Methods

**`connect(channelId: string): Promise<Channel>`**

Connect to a channel and return a Channel object for messaging.

```typescript
const channel = await client.connect("C123456");
```

**`disconnect(): Promise<void>`**

Disconnect from the chat platform.

```typescript
await client.disconnect();
```

**`onDisconnect(callback: (reason: string) => void): () => void`**

Register a callback for disconnection events. Returns an unsubscribe function.

```typescript
const unsubscribe = client.onDisconnect((reason) => {
  console.log("Disconnected:", reason);
});
```

**`onError(callback: (error: Error) => void): () => void`**

Register a callback for connection errors. Returns an unsubscribe function.

```typescript
client.onError((error) => {
  console.error("Connection error:", error);
});
```

### Channel

A platform-agnostic channel for messaging, reactions, typing indicators, and thread management.

#### Properties

**`id: string`** — Channel ID

**`platform: "discord" | "slack"`** — Platform identifier

#### Messaging

**`postMessage(content: MessageContent, options?: { files?: FileAttachment[]; linkPreviews?: boolean }): Message & PromiseLike<Message>`**

Post a message to the channel. Returns a Message that can be awaited or used immediately for chaining.

```typescript
// Simple text
const msg = await channel.postMessage("Hello!");

// Rich document (auto-converted to Discord Embed / Slack Block Kit)
import { Document } from "@hardlydifficult/document-generator";

const report = new Document()
  .header("Daily Report")
  .text("Here are today's **highlights**:")
  .list(["Feature A completed", "Bug B fixed", "99.9% uptime"]);

await channel.postMessage(report);

// With file attachments
await channel.postMessage("Here's the report", {
  files: [
    { content: Buffer.from("# Report\n..."), name: "report.md" },
    { content: "plain text", name: "notes.txt" },
  ],
});

// Chain reactions immediately (before awaiting)
const msg = channel
  .postMessage("Vote: 1, 2, or 3")
  .addReactions(["1️⃣", "2️⃣", "3️⃣"]);

// Await later
await msg;
```

**Oversized Message Handling:**

- **`postMessage`**: Messages exceeding platform limits (Discord: 2000 chars, Slack: 4000 chars) are automatically sent as file attachments
- **`update`**: Truncates with `…` (edits cannot attach files)

**`onMessage(callback: (message: Message) => void | Promise<void>): () => void`**

Subscribe to incoming messages in this channel. Messages from the bot itself are filtered out. Returns an unsubscribe function.

```typescript
const unsubscribe = channel.onMessage((msg) => {
  console.log(`${msg.author.username}: ${msg.content}`);
  msg.delete(); // Delete the user's command message
  msg.addReactions(["✅"]); // React to it
  msg.reply("Got it!"); // Reply in thread
});

// Later: stop listening
unsubscribe();
```

#### Reactions

**`Message.addReactions(emojis: string[]): this`**

Add emoji reactions to a message. Returns `this` for chaining.

```typescript
const msg = await channel.postMessage("Pick one");
msg.addReactions(["👍", "👎"]);
```

**`Message.removeReactions(emojis: string[]): this`**

Remove emoji reactions from a message. Returns `this` for chaining.

```typescript
msg.removeReactions(["👍"]);
```

**`Message.removeAllReactions(): this`**

Remove all reactions from a message (from all users). Returns `this` for chaining.

```typescript
msg.removeAllReactions();
```

> **Slack note:** Slack only allows removing the bot's own reactions. `removeAllReactions()` removes the bot's reactions for every emoji but cannot remove other users' reactions.

**`Message.onReaction(callback: (event: ReactionEvent) => void | Promise<void>): this`**

Listen for reactions on a message. Returns `this` for chaining.

```typescript
await channel
  .postMessage("Vote: (1) Pizza, (2) Burgers, (3) Salad")
  .addReactions(["1️⃣", "2️⃣", "3️⃣"])
  .onReaction((event) => {
    console.log(`${event.user.username} voted ${event.emoji}`);
  });
```

**`Message.offReaction(): void`**

Stop listening for reactions on a message.

```typescript
msg.offReaction();
```

**`Message.setReactions(emojis: string[], handler?: ReactionCallback): this`**

Declaratively set the reactions on a message. Computes the diff from the previous `setReactions` call, removing stale emojis and adding new ones. Replaces any existing reaction handler. Returns `this` for chaining.

```typescript
const msg = await channel.postMessage("PR #42: open");

// Set initial reactions
msg.setReactions(["🟡"], (event) => handlePending(event));

// Later: update to merged state — removes 🟡, adds 🟢, swaps handler
msg.setReactions(["🟢"], (event) => handleMerged(event));
```

**`Message.waitForReactions(): Promise<void>`**

Wait for all pending reactions to complete.

```typescript
const msg = await channel.postMessage("Vote!");
msg.addReactions(["👍", "👎"]);
await msg.waitForReactions(); // All reactions added
```

#### Dismissable Messages

**`postDismissable(content: MessageContent, ownerId: string): Promise<Message>`**

Post a message with a trash can reaction that the specified user can click to dismiss.

```typescript
await channel.postDismissable("Build complete!", userId);
```

#### Typing Indicators

**`sendTyping(): Promise<void>`**

Send a one-shot typing indicator.

```typescript
await channel.sendTyping();
```

**`beginTyping(): void`**

Mark the start of work that should show a typing indicator. The indicator is sent immediately and auto-refreshed until `endTyping()` is called. Multiple callers can overlap — the indicator stays active until all have ended.

```typescript
channel.beginTyping();
// ... do work ...
channel.endTyping();
```

**`endTyping(): void`**

Mark the end of one unit of work. When all outstanding `beginTyping()` calls have been balanced by `endTyping()`, the refresh interval stops.

**`withTyping<T>(fn: () => Promise<T>): Promise<T>`**

Show a typing indicator while executing a function. Uses ref-counted `beginTyping`/`endTyping` internally, so multiple concurrent `withTyping` calls share a single refresh interval.

```typescript
const result = await channel.withTyping(async () => {
  // typing indicator stays active during this work
  return await doExpensiveWork();
});
await channel.postMessage(result);
```

> **Slack note:** Slack does not support bot typing indicators. Both methods are no-ops on Slack.

#### Message Operations

**`Message.update(content: MessageContent): Promise<void>`**

Update a message's content.

```typescript
const msg = await channel.postMessage("Loading...");
await msg.update("Done!");
```

**`Message.delete(options?: { cascadeReplies?: boolean }): Promise<void>`**

Delete a message. By default, thread replies are also deleted.

```typescript
await msg.delete();
await msg.delete({ cascadeReplies: false }); // keep thread replies
```

#### Threads

**`createThread(content: MessageContent, name: string, autoArchiveDuration?: number): Promise<Thread>`**

Create a thread: posts a root message, starts a thread on it, and returns a Thread object.

```typescript
const thread = await channel.createThread("Starting a session!", "Session");
await thread.post("How can I help?");

thread.onReply(async (msg) => {
  await thread.post(`Got: ${msg.content}`);
});

await thread.delete();
```

**`openThread(threadId: string): Thread`**

Reconnect to an existing thread by ID (e.g., after a restart).

```typescript
const thread = channel.openThread(savedThreadId);
await thread.post("I'm back!");
thread.onReply(async (msg) => {
  /* ... */
});
```

**`Message.startThread(name: string, autoArchiveDuration?: number): Promise<Thread>`**

Create a thread from an existing message.

```typescript
const msg = await channel.postMessage("Starting a discussion");
const thread = await msg.startThread("Discussion Thread", 1440); // auto-archive in minutes
```

**`getThreads(): Promise<Thread[]>`**

Get all threads in this channel (active and archived).

```typescript
const threads = await channel.getThreads();
for (const thread of threads) {
  await thread.delete();
}
```

### Thread

A thread with messaging capabilities: post messages, listen for replies, and clean up when done.

#### Properties

**`id: string`** — Thread ID

**`channelId: string`** — Parent channel ID

**`platform: "discord" | "slack"`** — Platform identifier

#### Methods

**`post(content: MessageContent, files?: FileAttachment[]): Promise<Message>`**

Post a message in this thread.

```typescript
const msg = await thread.post("How can I help?");
await thread.post("Here's the report", [
  { content: "# Report\n...", name: "report.md" },
]);
```

**`onReply(callback: (message: Message) => void | Promise<void>): () => void`**

Subscribe to replies in this thread. Returns an unsubscribe function.

```typescript
thread.onReply(async (msg) => {
  await thread.post(`Got: ${msg.content}`);
});
```

**`offReply(): void`**

Stop listening for all replies in this thread.

```typescript
thread.offReply();
```

**`delete(): Promise<void>`**

Delete this thread and stop all reply listeners.

```typescript
await thread.delete();
```

**`stream(flushIntervalMs: number, abortSignal?: AbortSignal): StreamingReply`**

Stream messages into this thread by buffering text and flushing at a fixed interval. Long text is automatically chunked to fit within platform message limits.

```typescript
const stream = thread.stream(2000); // flush every 2s
stream.append("Processing...\n");
stream.append("Done!\n");
await stream.stop();
console.log(stream.content); // full accumulated text
```

**`editableStream(flushIntervalMs: number, abortSignal?: AbortSignal): EditableStreamReply`**

Stream messages into this thread by editing a single message in place. Text appended between flushes updates the same message rather than creating new ones. If the accumulated text exceeds the platform's message-length limit, the beginning is truncated.

```typescript
const stream = thread.editableStream(2000);
stream.append("Processing...\n");
stream.append("Still going...\n");
await stream.stop();
```

### Message

Represents a posted message with chainable reaction methods.

#### Properties

**`id: string`** — Message ID

**`channelId: string`** — Channel ID

**`platform: "discord" | "slack"`** — Platform identifier

**`content?: string`** — Message text content

**`author?: User`** — User who sent the message

**`timestamp?: Date`** — When the message was posted

**`attachments?: Attachment[]`** — File attachments on the message

#### Methods

**`reply(content: MessageContent, files?: FileAttachment[]): Message & PromiseLike<Message>`**

Reply in this message's thread. Returns a Message that can be awaited or used immediately for chaining.

```typescript
// Chain immediately
const reply = msg
  .reply("Got it!")
  .addReactions(["✅"]);

// Await later
await reply;

// Or await first
const reply = await msg.reply("Got it!");
```

**`streamReply(flushIntervalMs: number, abortSignal?: AbortSignal): StreamingReply`**

Buffer text and flush it as thread replies at a regular interval. Useful for commands that produce output over time.

```typescript
const msg = await channel.postMessage("Running...");
const stream = msg.streamReply(2000); // flush every 2s

stream.append("output line 1\n");
stream.append("output line 2\n");
// ... text is batched and sent as replies every 2 seconds

await stream.stop(); // flushes remaining text and stops the timer
console.log(stream.content); // full accumulated text across all flushes
```

**`update(content: MessageContent): Promise<void>`**

Update this message's content.

```typescript
await msg.update("Updated content");
```

**`delete(options?: { cascadeReplies?: boolean }): Promise<void>`**

Delete this message.

```typescript
await msg.delete();
await msg.delete({ cascadeReplies: false }); // keep thread replies
```

### StreamingReply

Buffers text