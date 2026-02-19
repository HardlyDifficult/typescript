# @hardlydifficult/queue

A high-performance priority queue with O(1) enqueue and dequeue operations, supporting FIFO ordering within priority levels.

## Installation

```bash
npm install @hardlydifficult/queue
```

## Quick Start

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<string>();

// Enqueue items with priorities
queue.enqueue("urgent task", "high");
queue.enqueue("normal task", "medium");
queue.enqueue("background task", "low");

// Dequeue in priority order (high → medium → low)
console.log(queue.dequeue()?.data); // "urgent task"
console.log(queue.dequeue()?.data); // "normal task"
console.log(queue.dequeue()?.data); // "background task"
```

## Core Operations

### Enqueue and Dequeue

Add items to the queue with a priority level (defaults to `"medium"`). Items are dequeued in priority order, with FIFO ordering within the same priority level.

```typescript
const queue = createPriorityQueue<string>();

// Enqueue with explicit priority
const item1 = queue.enqueue("task A", "high");
const item2 = queue.enqueue("task B", "high");
const item3 = queue.enqueue("task C", "medium");

// Dequeue returns highest priority first, FIFO within same priority
queue.dequeue()?.data; // "task A" (high, enqueued first)
queue.dequeue()?.data; // "task B" (high, enqueued second)
queue.dequeue()?.data; // "task C" (medium)
```

### Peek

Inspect the next item without removing it from the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("first", "high");
queue.enqueue("second", "low");

queue.peek()?.data; // "first" (highest priority)
queue.size; // Still 2
```

### Queue Status

Check the number of items and whether the queue is empty.

```typescript
const queue = createPriorityQueue<string>();

queue.isEmpty; // true
queue.size; // 0

queue.enqueue("item");
queue.isEmpty; // false
queue.size; // 1
```

## Item Management

### Remove Items

Remove a specific item by its ID. Returns `true` if the item was found and removed.

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("task", "high");

queue.remove(item.id); // true
queue.size; // 0
```

### Update Priority

Change an item's priority level while keeping its data and enqueue timestamp intact.

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("task", "low");

queue.updatePriority(item.id, "high"); // true
queue.peek()?.data; // "task" (now highest priority)
```

### Reorder Within Priority

Move an item before another item in the same priority bucket, or move it to the end of its bucket.

```typescript
const queue = createPriorityQueue<string>();
const a = queue.enqueue("A", "high");
const b = queue.enqueue("B", "high");
const c = queue.enqueue("C", "high");

// Move A before C
queue.moveBefore(a.id, c.id); // true
queue.toArray().map(i => i.data); // ["B", "A", "C"]

// Move B to the end
queue.moveToEnd(b.id); // true
queue.toArray().map(i => i.data); // ["A", "C", "B"]
```

## Snapshots and Listeners

### Get All Items

Retrieve all items in dequeue order without modifying the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("low", "low");
queue.enqueue("high", "high");
queue.enqueue("medium", "medium");

const items = queue.toArray();
items.map(i => i.data); // ["high", "medium", "low"]
queue.size; // Still 3
```

### Listen for Enqueues

Register a callback that fires whenever an item is enqueued. Returns an unsubscribe function.

```typescript
const queue = createPriorityQueue<string>();

const unsubscribe = queue.onEnqueue((item) => {
  console.log(`Enqueued: ${item.data} (priority: ${item.priority})`);
});

queue.enqueue("task", "high");
// Logs: "Enqueued: task (priority: high)"

unsubscribe();
queue.enqueue("another"); // No log
```

### Clear the Queue

Remove all items from the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("a");
queue.enqueue("b");

queue.clear();
queue.isEmpty; // true
```

## Item Metadata

Each enqueued item includes metadata accessible via the returned `QueueItem` object:

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("my task", "high");

item.data; // "my task"
item.priority; // "high"
item.id; // "q_1" (unique identifier)
item.enqueuedAt; // 1699564800000 (epoch milliseconds)
```

## Priority Levels

The queue supports three priority levels, dequeued in this order:

| Priority | Dequeue Order |
|----------|---------------|
| `"high"` | 1st           |
| `"medium"` | 2nd         |
| `"low"`  | 3rd           |

When no priority is specified, `"medium"` is used as the default.