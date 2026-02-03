# TypeScript Monorepo

A collection of focused, opinionated, and easy-to-use npm packages.

## Packages

- [`@monorepo/chat`](./packages/chat) - Unified chat client for Discord and Slack

## Development

```bash
npm install
npm run build
npm run test
```

---

# @monorepo/chat

A unified API for posting messages with emoji reactions to Discord and Slack channels, with callbacks for user reactions.

## Installation

```bash
npm install @monorepo/chat
```

## Quick Start

```typescript
import { createChatClient } from '@monorepo/chat';

// Create a Discord client
const client = createChatClient({
  type: 'discord',
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
});

// Or create a Slack client (same API)
const client = createChatClient({
  type: 'slack',
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Connect to a channel
const channel = await client.connect(channelId);

// Post a message with reactions (chainable)
await channel
  .postMessage('Vote: (1) Option A, (2) Option B, (3) Option C')
  .addReactions(['1️⃣', '2️⃣', '3️⃣']);

// Listen for user reactions
channel.onReaction((event) => {
  console.log(`${event.user.username} reacted with ${event.emoji}`);
});
```

## API

### `createChatClient(config)`

Factory function to create a chat client.

**Discord config:**
```typescript
{
  type: 'discord',
  token: string,      // Bot token
  guildId: string,    // Server ID
}
```

**Slack config:**
```typescript
{
  type: 'slack',
  token: string,      // Bot token (xoxb-...)
  appToken: string,   // App token (xapp-...)
  socketMode?: boolean, // Default: true
}
```

### `client.connect(channelId): Promise<Channel>`

Connect to a channel. Returns a `Channel` object.

### `channel.postMessage(text, options?): Message`

Post a message to the channel. Returns a `Message` object that can be awaited or chained.

```typescript
// Simple post
const message = await channel.postMessage('Hello!');

// With thread reply (Discord)
await channel.postMessage('Reply', { threadId: parentMessageId });
```

### `message.addReaction(emoji): Message`

Add a single reaction. Returns the message for chaining.

```typescript
await channel.postMessage('Hello!').addReaction('👋');
```

### `message.addReactions(emojis): Message`

Add multiple reactions. Returns the message for chaining.

```typescript
await channel.postMessage('Pick one:').addReactions(['1️⃣', '2️⃣', '3️⃣']);
```

### `channel.onReaction(callback): () => void`

Register a callback for when users add reactions. Returns an unsubscribe function.

```typescript
const unsubscribe = channel.onReaction((event) => {
  // event.emoji - The emoji added
  // event.user - User object with id and username
  // event.messageId - ID of the message
  // event.channelId - ID of the channel
  // event.timestamp - When the reaction was added
});

// Later: stop listening
unsubscribe();
```

### `client.disconnect(): Promise<void>`

Disconnect from the chat platform.

## Example: Poll

```typescript
import { createChatClient } from '@monorepo/chat';

const options = ['Pizza', 'Burgers', 'Salad'];
const emojis = ['1️⃣', '2️⃣', '3️⃣'];

async function runPoll(client, channelId, onVote) {
  const channel = await client.connect(channelId);

  // Post poll with reaction options
  const pollText = options
    .map((opt, i) => `${emojis[i]} ${opt}`)
    .join('\n');

  const message = await channel
    .postMessage(`Vote for lunch:\n\n${pollText}`)
    .addReactions(emojis);

  // Handle votes
  channel.onReaction((event) => {
    if (event.messageId !== message.id) return;

    const index = emojis.indexOf(event.emoji);
    if (index !== -1) {
      onVote({
        user: event.user,
        choice: options[index],
      });
    }
  });

  return channel;
}

// Usage
const client = createChatClient({
  type: 'discord',
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
});

const channel = await runPoll(client, 'channel-id', (vote) => {
  console.log(`${vote.user.username} voted for ${vote.choice}`);
});

// Later: cleanup
channel.disconnect();
await client.disconnect();
```

## Platform Setup

### Discord

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable these Gateway Intents: `GUILDS`, `GUILD_MESSAGES`, `GUILD_MESSAGE_REACTIONS`
3. Invite bot to server with permissions: `Send Messages`, `Add Reactions`, `Read Message History`
4. Set `DISCORD_TOKEN` and `DISCORD_GUILD_ID` environment variables

### Slack

1. Create an app at [Slack API](https://api.slack.com/apps)
2. Enable Socket Mode and generate an App Token
3. Add Bot Token Scopes: `chat:write`, `reactions:write`, `reactions:read`
4. Subscribe to events: `reaction_added`
5. Set `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` environment variables
