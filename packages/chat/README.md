# @hardlydifficult/chat

A TypeScript library for building chat bots with unified APIs for Discord and Slack, featuring threading, batching, streaming, commands, and cleanup.

## Installation

```bash
npm install @hardlydifficult/chat
```

## Quick Start

```typescript
import { createChatClient } from '@hardlydifficult/chat';

// Create a Discord or Slack client based on platform
const client = createChatClient('discord', {
  token: process.env.DISCORD_TOKEN!,
  // or: 'slack', { token: process.env.SLACK_TOKEN! }
});

// Listen for messages and respond
client.onMessage((event) => {
  event.channel.send('Hello, world!');
});

// Start listening
await client.start();
```

### Alternative Quick Start (with Message Operations)

```typescript
import { createChatClient } from "@hardlydifficult/chat";

// Connect to Discord or Slack
const client = createChatClient({ type: "discord" });
// or { type: "slack" }

const channel = await client.connect("channel-id");
await channel.postMessage("Hello world!").addReactions(["👍", "👎"]);
```

## Core Abstractions

### Chat Clients

The library provides platform-specific chat clients through a unified interface.

```typescript
import { DiscordChatClient, SlackChatClient, createChatClient } from '@hardlydifficult/chat';

// Factory function for any supported platform
const client = createChatClient('discord', { token: '...' });

// Or instantiate directly
const discordClient = new DiscordChatClient({ token: '...' });
const slackClient = new SlackChatClient({ token: '...' });
```

Each client supports:
- Message event handling via `onMessage()`
- Reaction event handling via `onReaction()`
- Platform-specific startup logic via `start()`
- Graceful shutdown via `stop()`

### Channel and Message

The `Channel` class abstracts messaging operations across platforms.

```typescript
// Send a message and get a ReplyMessage reference
const message = await channel.send('Hello');
await message.react('👍');
await message.reply('Thanks for the feedback!');
await message.delete(); // Only the bot's message
await channel.cleanup('all'); // Delete all bot messages in the channel
```

Messages are represented by the `Message` interface:

```typescript
interface Message {
  id: string;
  author: Member;
  content: string;
  timestamp: Date;
  reactions: Reaction[];
  thread?: Thread;
  channel: Channel;
  
  reply(content: string): Promise<ReplyMessage>;
  update(content: string): Promise<void>;
  delete(): Promise<void>;
  react(emoji: string): Promise<void>;
  clearReactions(): Promise<void>;
}
```

### Thread

Threads provide an isolated messaging context with its own lifecycle.

```typescript
// Create and use a thread
const thread = await channel.createThread('Discussions');
await thread.send('Let us discuss this here.');
await thread.sendStream('Streaming responses...');
await thread.cleanup('bot'); // Remove only bot messages
```

## Message Batching

Batching allows grouping multiple messages and managing them collectively.

```typescript
import { MessageBatch } from '@hardlydifficult/chat';

// Create a batch
const batch = channel.batch();
batch.add(channel.send('First'));
batch.add(channel.send('Second'));

// Finish and keep only the latest
await batch.finish({ mode: 'keepLatest' });

// Or delete everything
await batch.delete();
```

The `MessageBatch` class supports:
- `add(promise)`: Add a pending message to the batch
- `finish(options)`: Finalize batch with modes: `'keepAll'`, `'keepLatest'`, `'deleteAll'`
- `delete()`: Delete all batched messages
- `query()`: Get list of posted messages

## Streaming Replies

The library supports real-time streaming with automatic message updates.

```typescript
// Use StreamingReply for automatic chunking
const stream = channel.stream({ mode: 'thread' });
stream.append('Hello, ');
await stream.flush(); // Force immediate delivery
stream.append('world!');
await stream.finish(); // Finalize with message deletion or edit
```

The `EditableStreamReply` class allows in-place editing:

```typescript
const stream = new EditableStreamReply(thread, { maxMessageLength: 2000 });
stream.append('Initial ');
await stream.flush();
stream.append('content.');
await stream.finish();
```

Both support:
- `append(text)`: Add text to buffer
- `flush()`: Send current buffer as message update
- `finish()`: Finalize and cleanup
- `abort()`: Cancel the stream mid-operation

## Commands

A regex-based command system with auto-parsing and context-aware routing.

```typescript
import { CommandDispatcher, CommandRegistry, Command } from '@hardlydifficult/chat';

const registry = new CommandRegistry();

// Register a command with auto-parsed arguments
registry.register({
  name: 'ping',
  pattern: /^ping(\s+help)?$/i,
  handler: async ({ context, match }) => {
    if (match[1]) {
      return 'Usage: `ping` or `ping help`';
    }
    return 'Pong!';
  }
});

// Use dispatcher to route messages
const dispatcher = new CommandDispatcher(registry);
dispatcher.onMessage((event) => {
  event.channel.typingIndicator.start();
  return dispatcher.handle(event);
});
```

### Command Types

Commands are defined using:

```typescript
interface Command {
  name: string;
  pattern: RegExp;
  handler: (args: {
    context: Context;
    match: RegExpExecArray;
    event: MessageEvent;
  }) => Promise<string | void>;
}
```

Contexts include channel, user, and optional state:

```typescript
interface Context {
  channel: Channel;
  user: Member;
  state?: Map<string, any>;
}
```

### Job Lifecycle

Long-running commands support cancel/dismiss UI flows:

```typescript
import { startJobLifecycle } from '@hardlydifficult/chat';

await startJobLifecycle(thread, {
  onCancel: async () => {
    // Handle user-initiated cancellation
  },
  onDismiss: async () => {
    // Add dismiss emoji for user to remove later
  }
});
```

## Member Matching

Resolve users by mention, ID, or fuzzy match:

```typescript
import { matchMember } from '@hardlydifficult/chat';

// Match a member by mention or name
const member = await matchMember(
  channel,
  '@john', // or 'john', or '123456789'
  { fuzzyThreshold: 0.7 }
);

// Use aliases for more lenient matching
const aliases = { 'johnny': 'john' };
const member = await matchMember(channel, 'johnny', { aliases });
```

## Output Formatting

Convert abstract document blocks into platform-specific formats.

```typescript
import { formatDiscord, formatSlack } from '@hardlydifficult/chat';

const document = {
  type: 'doc',
  content: [
    { type: 'text', text: 'Hello ' },
    { type: 'bold', content: 'world' }
  ]
};

const discordPayload = formatDiscord(document);
const slackBlocks = formatSlack(document);
```

Supported block types include:
- `text`, `bold`, `italic`, `code`, `pre`
- `header`, `divider`, `section`, `button`
- `mention` (platform-specific user/channel reference)

## Message Tracking

Track and update messages by key for efficient dynamic updates.

```typescript
import { MessageTracker } from '@hardlydifficult/chat';

const tracker = new MessageTracker(channel);
tracker.track('status', async () => channel.send('Updating...'));
tracker.edit('status', async (message) => {
  await message.update('Updated!');
});
```

## File Operations

Post and update messages with file attachments.

```typescript
// Discord: attach files via buildMessagePayload
import { buildMessagePayload } from '@hardlydifficult/chat/discord';

const payload = buildMessagePayload({
  content: 'Report',
  files: [{ filename: 'report.pdf', data: buffer }]
});

await channel.send(payload);

// Slack: use built-in file support
await slackClient.postMessage({
  channel: 'C123',
  text: 'Report',
  file: buffer,
  filename: 'report.pdf'
});
```

## Setup

### Discord

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable **MESSAGE CONTENT INTENT** in bot settings
3. Invite with `bot` and `applications.commands` scopes
4. Set `DISCORD_TOKEN` environment variable

### Slack

1. Create a Slack app at [Slack API](https://api.slack.com/apps)
2. Add **Incoming Webhooks** and **Bot User Token** scopes
3. Install to workspace and copy token
4. Set `SLACK_TOKEN` environment variable

## Platform Differences

| Feature                     | Discord                            | Slack                              |
|----------------------------|------------------------------------|------------------------------------|
| Message Length Limit       | 2000 characters                    | 4000 characters                    |
| Thread Support             | Text channel threads               | Conversations with replies         |
| File Uploads               | Via `buildMessagePayload`          | Via `chat.postMessage`             |
| Typing Indicators          | Supported via `typingIndicator`    | Supported via `chat.scheduledMsg`  |
| Message History            | Requires **MESSAGE CONTENT INTENT**| Requires `history` scope           |
| Mention Resolution         | By ID or username#discriminator    | By `@username` or user ID          |
| Emoji Reactions            | Unicode or custom emoji (with ID)  | Custom emoji only by name          |

## Appendix

### Error Handling

Platform-specific error codes are mapped to user-friendly messages:

```typescript
import { isRecoverableError, getErrorFriendlyMessage } from '@hardlydifficult/chat';

try {
  await channel.send('Failed message');
} catch (error) {
  if (isRecoverableError(error)) {
    // Retry with backoff
  } else {
    console.log(getErrorFriendlyMessage(error));
  }
}
```

Recoverable errors include:
- Rate limits (`429 Too Many Requests`)
- Network timeouts
- Temporary unavailability

### Cleanup Modes

The `cleanup` method supports:

| Mode      | Behavior                                     |
|-----------|----------------------------------------------|
| `all`     | Delete all messages (bot + users)            |
| `bot`     | Delete only bot-authored messages            |
| `user`    | Delete only user-authored messages           |
| `since`   | Delete messages newer than timestamp         |

Example:
```typescript
await channel.cleanup({ mode: 'since', timestamp: new Date(Date.now() - 86400000) });
```