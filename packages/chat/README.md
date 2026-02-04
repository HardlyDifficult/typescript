# @hardlydifficult/chat

Unified API for Discord and Slack messaging with rich document support.

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

## Rich Documents

Post rich, formatted messages using the `@hardlydifficult/documentGenerator` package:

```typescript
import { doc } from '@hardlydifficult/documentGenerator';
import { createChatClient } from '@hardlydifficult/chat';

const client = createChatClient({ type: 'slack' });
const channel = await client.connect(channelId);

const report = doc()
  .header('Daily Report')
  .text('Here are today's **highlights**:')
  .list(['Feature A completed', 'Bug B fixed', '99.9% uptime'])
  .divider()
  .link('View dashboard', 'https://example.com/dashboard')
  .context('Generated automatically');

// Automatically converted to Slack Block Kit / Discord Embed
await channel.postMessage(report);
```

## Message Operations

### Update Messages

```typescript
const msg = await channel.postMessage('Initial content');
await msg.update('Updated content');
await msg.update(doc().header('New Header').text('New body'));
```

### Delete Messages

```typescript
const msg = await channel.postMessage('Temporary message');
await msg.delete();
```

### Thread Replies

```typescript
const msg = await channel.postMessage('Main message');
msg.postReply('This is a thread reply');
msg.postReply(doc().text('Rich reply with **formatting**'));
```

### Reactions

```typescript
// Add reactions (chainable)
const msg = channel
  .postMessage('Pick one')
  .addReactions(['👍', '👎'])
  .addReactions(['🤷']);

// Wait for reactions to complete
await msg.waitForReactions();

// Listen for user reactions
channel.onReaction((event) => {
  console.log(`${event.user.username} reacted with ${event.emoji}`);
});
```

## API Reference

### `createChatClient(config)`

```typescript
// Discord - env vars: DISCORD_TOKEN, DISCORD_GUILD_ID
createChatClient({ type: 'discord' });
createChatClient({ type: 'discord', token: '...', guildId: '...' });

// Slack - env vars: SLACK_BOT_TOKEN, SLACK_APP_TOKEN
createChatClient({ type: 'slack' });
createChatClient({ type: 'slack', token: '...', appToken: '...' });
```

### `client.connect(channelId): Promise<Channel>`

Connect to a channel.

### `channel.postMessage(content): Message`

Post a message. Content can be a string or a Document.

### `message.addReactions(emojis): Message`

Add reactions. Chainable and awaitable.

### `message.postReply(content): Message`

Post a reply in the message's thread.

### `message.update(content): Promise<void>`

Update the message content.

### `message.delete(): Promise<void>`

Delete the message.

### `message.waitForReactions(): Promise<void>`

Wait for all pending reactions to complete.

### `channel.onReaction(callback): () => void`

Listen for reactions. Returns unsubscribe function.

```typescript
const unsubscribe = channel.onReaction((event) => {
  // event.emoji, event.user.id, event.user.username, 
  // event.messageId, event.channelId, event.timestamp
});
```

### `client.disconnect(): Promise<void>`

Disconnect from the platform.

## Custom Outputters

For advanced use cases, convert documents to platform-specific formats:

```typescript
import { doc } from '@hardlydifficult/documentGenerator';
import { toSlackBlocks, toDiscordEmbed } from '@hardlydifficult/chat';

const document = doc()
  .header('Alert')
  .text('Something **important** happened')
  .context('2025-01-15');

// Get Slack Block Kit JSON
const slackBlocks = toSlackBlocks(document.getBlocks());

// Get Discord Embed object
const discordEmbed = toDiscordEmbed(document.getBlocks());
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
3. Bot scopes: `chat:write`, `chat:write.public`, `reactions:write`, `reactions:read`
4. Subscribe to: `reaction_added`
5. Set `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` env vars

## Example: Interactive Poll

```typescript
import { createChatClient } from '@hardlydifficult/chat';
import { doc } from '@hardlydifficult/documentGenerator';

const client = createChatClient({ type: 'discord' });
const channel = await client.connect(process.env.CHANNEL_ID);

const options = ['Pizza', 'Burgers', 'Salad'];
const emojis = ['1️⃣', '2️⃣', '3️⃣'];
const votes: Record<string, string> = {};

const pollDoc = doc()
  .header('🗳️ Lunch Poll')
  .text('What should we order?')
  .list(options.map((o, i) => `${emojis[i]} ${o}`));

const msg = await channel.postMessage(pollDoc).addReactions(emojis);

channel.onReaction((event) => {
  if (event.messageId !== msg.id) return;

  const choice = options[emojis.indexOf(event.emoji)];
  if (choice) {
    votes[event.user.id] = choice;
    console.log(`${event.user.username} voted for ${choice}`);
  }
});
```
