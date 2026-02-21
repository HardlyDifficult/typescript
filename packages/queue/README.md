# @hardlydifficult/queue

A high-performance priority queue implementation with O(1) enqueue and dequeue operations, supporting FIFO ordering within priority levels.

## Installation

```bash
npm install @hardlydifficult/queue
```

## Quick Start

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<string>();

queue.enqueue("low-priority", "low");
queue.enqueue("urgent", "high");
queue.enqueue("standard"); // defaults to 'medium'

// Dequeues in priority order, then by insertion time
console.log(queue.dequeue()?.data); // "urgent"
console.log(queue.dequeue()?.data); // "standard"
console.log(queue.dequeue()?.data); // "low-priority"
```

## Core API

### createPriorityQueue

Creates a new priority queue instance.

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<number>();
```

### PriorityQueue Interface

All queue operations are provided via the `PriorityQueue<T>` interface returned by `createPriorityQueue()`.

#### enqueue(data, priority?)

Adds an item to the queue.

| Parameter | Type      | Default   | Description                  |
|-----------|-----------|-----------|------------------------------|
| data      | `T`       | —         | The item data to enqueue     |
| priority  | `Priority`| `"medium"`| Priority level: `"high"`, `"medium"`, or `"low"` |

Returns a `QueueItem<T>` with metadata including unique ID and enqueue timestamp.

```typescript
const item = queue.enqueue("task", "high");
console.log(item.id); // "q_1"
console.log(item.priority); // "high"
```

#### dequeue()

Removes and returns the highest-priority item (FIFO within same priority).

```typescript
const item = queue.dequeue();
if (item) {
  console.log(item.data); // "urgent"
}
```

Returns `undefined` if the queue is empty.

#### peek()

Returns the next item to be dequeued without removing it.

```typescript
const next = queue.peek();
if (next) {
  console.log(next.data); // First item to be dequeued
}
```

#### remove(id)

Removes an item by its unique ID.

```typescript
const item = queue.enqueue("remove-me");
const removed = queue.remove(item.id); // true
const absent = queue.remove("unknown"); // false
```

#### size

Readonly property returning the total number of items in the queue.

```typescript
console.log(queue.size); // 5
```

#### isEmpty

Readonly property indicating whether the queue is empty.

```typescript
console.log(queue.isEmpty); // false
```

#### onEnqueue(callback)

Registers a callback invoked whenever an item is enqueued.

Returns an unsubscribe function.

```typescript
const unsubscribe = queue.onEnqueue((item) => {
  console.log("Enqueued:", item.data);
});

queue.enqueue("test");
unsubscribe();
queue.enqueue("ignored"); // callback no longer invoked
```

#### toArray()

Returns a snapshot of all items in dequeue order (by priority, then FIFO). Does not modify the queue.

```typescript
const items = queue.toArray();
// Items sorted by priority: high → medium → low, then by insertion order
```

#### clear()

Removes all items from the queue.

```typescript
queue.enqueue("a");
queue.enqueue("b");
queue.clear();
console.log(queue.size); // 0
```

### Priority Updates

#### updatePriority(id, newPriority)

Changes the priority of an existing item.

```typescript
const item = queue.enqueue("task", "low");
queue.updatePriority(item.id, "high"); // true
```

Returns `true` if the item was found and updated, `false` otherwise.

#### moveBefore(itemId, beforeItemId)

Moves an item before another item within the same priority bucket.

```typescript
const a = queue.enqueue("a", "medium");
const b = queue.enqueue("b", "medium");
const c = queue.enqueue("c", "medium");

queue.moveBefore(c.id, a.id); // true
console.log(queue.toArray().map(i => i.data)); // ["c", "a", "b"]
```

Both items must exist and share the same priority. Returns `true` on success.

#### moveToEnd(itemId)

Moves an item to the end of its priority bucket.

```typescript
const a = queue.enqueue("a", "medium");
const b = queue.enqueue("b", "medium");
queue.moveToEnd(a.id); // true
console.log(queue.toArray().map(i => i.data)); // ["b", "a"]
```

Returns `true` if the item was found (even if already at end), `false` otherwise.

## QueueItem Type

Represents an item in the queue with metadata:

```typescript
interface QueueItem<T> {
  data: T;
  priority: Priority;
  enqueuedAt: number; // epoch milliseconds
  id: string;         // unique identifier
}
```

## Priority Order

Priority levels are ordered from highest to lowest:

1. `"high"`
2. `"medium"` (default)
3. `"low"`

Items with higher priority are dequeued before items with lower priority. Within the same priority, items are dequeued in FIFO order (first-in, first-out).