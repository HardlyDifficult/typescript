# @hardlydifficult/queue

A high-performance priority queue with O(1) enqueue/dequeue and FIFO ordering within priority levels.

## Installation

```bash
npm install @hardlydifficult/queue
```

## Quick Start

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<string>();

// Enqueue items with priority (defaults to "medium")
queue.enqueue("low-priority-task", "low");
queue.enqueue("urgent-task", "high");

// Dequeue follows priority order: high → medium → low, FIFO within each
console.log(queue.dequeue()?.data); // "urgent-task"
console.log(queue.dequeue()?.data); // "low-priority-task"
```

## Core API

### Priority Levels

Three priority levels are supported: `"high"`, `"medium"`, and `"low"`. Items are dequeued in high → medium → low order, with FIFO ordering within each level.

```typescript
import type { Priority } from "@hardlydifficult/queue";

const priority: Priority = "high"; // or "medium", "low"
```

### QueueItem Interface

Each enqueued item includes metadata:

| Property     | Type     | Description                     |
|--------------|----------|---------------------------------|
| `data`       | `T`      | The queued data                 |
| `priority`   | `Priority` | Priority level                |
| `enqueuedAt` | `number` | Timestamp (epoch ms)            |
| `id`         | `string` | Unique identifier (e.g. `"q_1"`) |

### PriorityQueue Interface

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";
import type { PriorityQueue } from "@hardlydifficult/queue";

const queue: PriorityQueue<string> = createPriorityQueue();
```

#### `enqueue(data: T, priority?: Priority): QueueItem<T>`

Add an item to the queue.

```typescript
const queue = createPriorityQueue<number>();
const item = queue.enqueue(42, "high");

console.log(item.id);        // "q_1"
console.log(item.priority);  // "high"
console.log(item.enqueuedAt); // e.g. 1717020000000
```

#### `dequeue(): QueueItem<T> | undefined`

Remove and return the highest-priority item. Returns `undefined` if empty.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("a");
queue.dequeue()?.data; // "a"
queue.dequeue();       // undefined
```

#### `peek(): QueueItem<T> | undefined`

Return the next item without removing it.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("first");
queue.enqueue("second");

console.log(queue.peek()?.data); // "first"
console.log(queue.size);         // 2
```

#### `remove(id: string): boolean`

Remove a specific item by ID.

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("to-remove");
queue.enqueue("to-keep");

queue.remove(item.id); // true
queue.size;            // 1
```

#### `size: number`

Number of items in the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("a");
queue.enqueue("b");
queue.size; // 2
```

#### `isEmpty: boolean`

Whether the queue is empty.

```typescript
const queue = createPriorityQueue<string>();
queue.isEmpty; // true
queue.enqueue("a");
queue.isEmpty; // false
```

#### `onEnqueue(callback: (item: QueueItem<T>) => void): () => void`

Register a callback invoked on every enqueue. Returns an unsubscribe function.

```typescript
const queue = createPriorityQueue<string>();

const unsubscribe = queue.onEnqueue((item) => {
  console.log("Enqueued:", item.data);
});

queue.enqueue("test"); // Logs: Enqueued: test
unsubscribe();
queue.enqueue("ignored"); // No log
```

#### `toArray(): readonly QueueItem<T>[]`

Return a snapshot of all items in dequeue order.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("low", "low");
queue.enqueue("high", "high");

queue.toArray().map(i => i.data); // ["high", "low"]
queue.size;                       // Still 2 (does not modify queue)
```

#### `clear(): void`

Remove all items from the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("a");
queue.enqueue("b");
queue.clear();
queue.size; // 0
```

### Advanced Operations

#### `updatePriority(id: string, newPriority: Priority): boolean`

Change the priority of an existing item.

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("task", "low");
queue.updatePriority(item.id, "high");
queue.peek()?.data; // "task" (now processed first)
```

#### `moveBefore(itemId: string, beforeItemId: string): boolean`

Move `itemId` before `beforeItemId` in the same priority bucket.

```typescript
const queue = createPriorityQueue<string>();
const a = queue.enqueue("a");
const b = queue.enqueue("b");
const c = queue.enqueue("c");

queue.moveBefore(c.id, a.id); // true
queue.toArray().map(i => i.data); // ["c", "a", "b"]
```

#### `moveToEnd(itemId: string): boolean`

Move an item to the end of its priority bucket.

```typescript
const queue = createPriorityQueue<string>();
const a = queue.enqueue("a");
const b = queue.enqueue("b");
const c = queue.enqueue("c");

queue.moveToEnd(a.id); // true
queue.toArray().map(i => i.data); // ["b", "c", "a"]
```

## API Reference

### Types

| Name         | Description                              |
|--------------|------------------------------------------|
| `Priority`   | `"high" | "medium" | "low"`             |
| `QueueItem<T>` | Item with `data`, `priority`, `enqueuedAt`, `id` |
| `PriorityQueue<T>` | Core queue interface                |

### Exports

| Export               | Description                      |
|----------------------|----------------------------------|
| `createPriorityQueue<T>()` | Factory function for new queues |
| `PriorityQueue<T>`   | Queue interface type             |
| `QueueItem<T>`       | Item interface type              |
| `Priority`           | Priority type alias              |

### Time Complexity

| Operation              | Complexity |
|------------------------|------------|
| `enqueue`, `dequeue`, `peek`, `toArray`, `size`, `isEmpty`, `clear` | O(1) |
| `remove`, `updatePriority`, `moveBefore`, `moveToEnd` | O(n) |