# @hardlydifficult/chat

Unified API for posting messages with emoji reactions to Discord and Slack.

## Installation

```bash
npm install @hardlydifficult/chat
```

## Quick Start

```typescript
import { createChatClient } from '@hardlydifficult/chat';

// Uses DISCORD_TOKEN and DISCORD_GUILD_ID env vars
const client = createChatClient({ type: 'discord' });

// Or for Slack: uses SLACK_BOT_TOKEN and SLACK_APP_TOKEN env vars
const client = createChatClient({ type: 'slack' });

const channel = await client.connect(channelId);

await channel
  .postMessage('Vote: (1) Pizza, (2) Burgers, (3) Salad')
  .addReactions(['1️⃣', '2️⃣', '3️⃣']);

channel.onReaction((event) => {
  console.log(`${event.user.username} voted ${event.emoji}`);
});
```

## API

### `createChatClient(config)`

```typescript
// Discord - env vars: DISCORD_TOKEN, DISCORD_GUILD_ID
createChatClient({ type: 'discord' });
createChatClient({ type: 'discord', token: '...', guildId: '...' }); // override

// Slack - env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN
createChatClient({ type: 'slack' });
createChatClient({ type: 'slack', token: '...', appToken: '...' }); // override
```

### `client.connect(channelId): Promise<Channel>`

Connect to a channel.

### `channel.postMessage(text): Message`

Post a message. Returns a chainable `Message`.

### `message.addReactions(emojis): Message`

Add reactions. Chainable and awaitable.

```typescript
await channel.postMessage('Pick one').addReactions(['1️⃣', '2️⃣']);
```

### `channel.onReaction(callback): () => void`

Listen for reactions. Returns unsubscribe function.

```typescript
const unsubscribe = channel.onReaction((event) => {
  // event.emoji, event.user.id, event.user.username, event.messageId
});
```

### `client.disconnect(): Promise<void>`

Disconnect from the platform.

## Example: Poll

```typescript
import { createChatClient } from '@hardlydifficult/chat';

const client = createChatClient({ type: 'discord' });
const channel = await client.connect(process.env.CHANNEL_ID);

const options = ['Pizza', 'Burgers', 'Salad'];
const emojis = ['1️⃣', '2️⃣', '3️⃣'];

const message = await channel
  .postMessage(options.map((o, i) => `${emojis[i]} ${o}`).join('\n'))
  .addReactions(emojis);

channel.onReaction((event) => {
  if (event.messageId !== message.id) return;

  const choice = options[emojis.indexOf(event.emoji)];
  if (choice) {
    console.log(`${event.user.username} voted for ${choice}`);
  }
});
```

## Platform Setup

### Discord

1. Create bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable Gateway Intents: `GUILDS`, `GUILD_MESSAGES`, `GUILD_MESSAGE_REACTIONS`
3. Bot permissions: `Send Messages`, `Add Reactions`, `Read Message History`
4. Set `DISCORD_TOKEN` and `DISCORD_GUILD_ID` env vars

### Slack

1. Create app at [Slack API](https://api.slack.com/apps)
2. Enable Socket Mode, generate App Token
3. Bot scopes: `chat:write`, `reactions:write`, `reactions:read`
4. Subscribe to: `reaction_added`
5. Set `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` env vars
