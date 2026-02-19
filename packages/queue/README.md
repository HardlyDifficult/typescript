I'll start by exploring the package structure and reading the source files to understand the API.Now I have all the information I need to write a comprehensive README. Let me create it:

# @hardlydifficult/queue

A high-performance priority queue with O(1) enqueue and dequeue operations, supporting FIFO ordering within priority levels.

## Installation

```bash
npm install @hardlydifficult/queue
```

## Usage

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<string>();

// Enqueue items with priorities
queue.enqueue("urgent task", "high");
queue.enqueue("normal task", "medium");
queue.enqueue("background task", "low");

// Dequeue in priority order (high → medium → low, FIFO within each level)
console.log(queue.dequeue()?.data); // "urgent task"
console.log(queue.dequeue()?.data); // "normal task"
console.log(queue.dequeue()?.data); // "background task"
```

## API Reference

### `createPriorityQueue<T>()`

Creates a new priority queue instance.

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<number>();
```

**Returns:** `PriorityQueue<T>` — A new queue instance.

---

### `enqueue(data, priority?)`

Add an item to the queue.

```typescript
const queue = createPriorityQueue<string>();

const item1 = queue.enqueue("task 1"); // defaults to "medium"
const item2 = queue.enqueue("task 2", "high");
const item3 = queue.enqueue("task 3", "low");

console.log(item1.id);        // "q_1"
console.log(item1.priority);  // "medium"
console.log(item1.enqueuedAt); // 1699564800000 (timestamp)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `T` | — | The item to queue |
| `priority` | `"high" \| "medium" \| "low"` | `"medium"` | Priority level |

**Returns:** `QueueItem<T>` — The queued item with metadata (id, priority, enqueuedAt).

---

### `dequeue()`

Remove and return the highest-priority item. Within the same priority, returns items in FIFO order.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("first", "medium");
queue.enqueue("second", "medium");
queue.enqueue("urgent", "high");

console.log(queue.dequeue()?.data); // "urgent" (high priority)
console.log(queue.dequeue()?.data); // "first" (FIFO within medium)
console.log(queue.dequeue()?.data); // "second"
console.log(queue.dequeue());       // undefined (empty)
```

**Returns:** `QueueItem<T> | undefined` — The next item, or undefined if empty.

---

### `peek()`

View the next item without removing it.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("task", "high");

console.log(queue.peek()?.data); // "task"
console.log(queue.size);         // 1 (unchanged)
console.log(queue.peek()?.data); // "task" (same item)
```

**Returns:** `QueueItem<T> | undefined` — The next item, or undefined if empty.

---

### `remove(id)`

Remove a specific item by its ID.

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("task");

console.log(queue.remove(item.id)); // true
console.log(queue.size);            // 0
console.log(queue.remove(item.id)); // false (already removed)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The item's unique ID |

**Returns:** `boolean` — True if the item was found and removed.

---

### `size`

Get the number of items currently in the queue.

```typescript
const queue = createPriorityQueue<string>();
console.log(queue.size); // 0

queue.enqueue("a");
queue.enqueue("b");
console.log(queue.size); // 2

queue.dequeue();
console.log(queue.size); // 1
```

**Type:** `number` (read-only)

---

### `isEmpty`

Check if the queue is empty.

```typescript
const queue = createPriorityQueue<string>();
console.log(queue.isEmpty); // true

queue.enqueue("task");
console.log(queue.isEmpty); // false
```

**Type:** `boolean` (read-only)

---

### `clear()`

Remove all items from the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("a", "high");
queue.enqueue("b", "medium");
queue.enqueue("c", "low");

queue.clear();
console.log(queue.size);    // 0
console.log(queue.isEmpty); // true
```

---

### `toArray()`

Get all items in dequeue order without modifying the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("low-1", "low");
queue.enqueue("high-1", "high");
queue.enqueue("medium-1", "medium");
queue.enqueue("high-2", "high");

const items = queue.toArray();
console.log(items.map(i => i.data));
// ["high-1", "high-2", "medium-1", "low-1"]

console.log(queue.size); // 4 (unchanged)
```

**Returns:** `readonly QueueItem<T>[]` — Snapshot of all items in priority order.

---

### `onEnqueue(callback)`

Register a callback invoked whenever an item is enqueued.

```typescript
const queue = createPriorityQueue<string>();

const unsubscribe = queue.onEnqueue((item) => {
  console.log(`Enqueued: ${item.data} (priority: ${item.priority})`);
});

queue.enqueue("task 1", "high");
// Logs: "Enqueued: task 1 (priority: high)"

unsubscribe();
queue.enqueue("task 2", "medium");
// No log (listener unsubscribed)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `(item: QueueItem<T>) => void` | Function called on each enqueue |

**Returns:** `() => void` — Unsubscribe function to remove the listener.

---

### `updatePriority(id, newPriority)`

Change the priority of an existing item. The item is moved to the new priority bucket and appended to the end.

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("task", "low");

console.log(queue.peek()?.data); // "task" (low priority, at front)

queue.updatePriority(item.id, "high");
console.log(queue.peek()?.data); // "task" (now high priority, at front)

console.log(queue.updatePriority("nonexistent", "high")); // false
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The item's unique ID |
| `newPriority` | `"high" \| "medium" \| "low"` | The new priority level |

**Returns:** `boolean` — True if the item was found and updated.

---

### `moveBefore(itemId, beforeItemId)`

Move an item before another item within the same priority bucket. Both items must exist and share the same priority.

```typescript
const queue = createPriorityQueue<string>();
const item1 = queue.enqueue("first", "high");
const item2 = queue.enqueue("second", "high");
const item3 = queue.enqueue("third", "high");

queue.moveBefore(item3.id, item1.id);
const items = queue.toArray().map(i => i.data);
console.log(items); // ["third", "first", "second"]

// Cannot move between different priorities
const low = queue.enqueue("low-task", "low");
console.log(queue.moveBefore(low.id, item1.id)); // false
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId` | `string` | The item to move |
| `beforeItemId` | `string` | The item to move before |

**Returns:** `boolean` — True if both items exist in the same priority bucket and the move succeeded.

---

### `moveToEnd(itemId)`

Move an item to the end of its priority bucket.

```typescript
const queue = createPriorityQueue<string>();
const item1 = queue.enqueue("first", "high");
const item2 = queue.enqueue("second", "high");
const item3 = queue.enqueue("third", "high");

queue.moveToEnd(item1.id);
const items = queue.toArray().map(i => i.data);
console.log(items); // ["second", "third", "first"]

console.log(queue.moveToEnd(item1.id)); // true (already at end)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `itemId` | `string` | The item to move |

**Returns:** `boolean` — True if the item was found and moved (or was already at the end).

---

## Types

### `Priority`

```typescript
type Priority = "high" | "medium" | "low";
```

Priority levels for queue items. Items are dequeued in order: high → medium → low.

---

### `QueueItem<T>`

```typescript
interface QueueItem<T> {
  readonly data: T;
  readonly priority: Priority;
  readonly enqueuedAt: number;
  readonly id: string;
}
```

Metadata for a queued item.

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T` | The queued data |
| `priority` | `Priority` | Priority level |
| `enqueuedAt` | `number` | Timestamp when enqueued (epoch ms) |
| `id` | `string` | Unique identifier for this queue entry |

---

### `PriorityQueue<T>`

```typescript
interface PriorityQueue<T> {
  enqueue(data: T, priority?: Priority): QueueItem<T>;
  dequeue(): QueueItem<T> | undefined;
  peek(): QueueItem<T> | undefined;
  remove(id: string): boolean;
  readonly size: number;
  readonly isEmpty: boolean;
  onEnqueue(callback: (item: QueueItem<T>) => void): () => void;
  toArray(): readonly QueueItem<T>[];
  clear(): void;
  updatePriority(id: string, newPriority: Priority): boolean;
  moveBefore(itemId: string, beforeItemId: string): boolean;
  moveToEnd(itemId: string): boolean;
}
```

The main queue interface. All operations are O(1) except `toArray()` which is O(n).