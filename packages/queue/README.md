# @hardlydifficult/queue

A high-performance priority queue with O(1) enqueue/dequeue operations and FIFO ordering within priority levels.

## Installation

```bash
npm install @hardlydifficult/queue
```

## Quick Start

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<string>();

queue.enqueue("low-priority task", "low");
queue.enqueue("urgent fix", "high");

// High priority item dequeued first
console.log(queue.dequeue()?.data); // "urgent fix"
console.log(queue.dequeue()?.data); // "low-priority task"
```

## Priority-Based Ordering

Items are dequeued in priority order: high → medium → low. Within each priority level, items follow FIFO (first-in, first-out) order.

```typescript
const queue = createPriorityQueue<string>();

queue.enqueue("a", "low");
queue.enqueue("b", "high");
queue.enqueue("c", "medium");
queue.enqueue("d", "high");

// Dequeue order: b, d, c, a
console.log(queue.toArray().map(i => i.data)); // ["b", "d", "c", "a"]
```

### Priority Levels

| Priority | Dequeue Order |
|----------|---------------|
| `high`   | First         |
| `medium` | Second (default) |
| `low`    | Third         |

## Queue Operations

### `enqueue(data, priority?)`

Adds an item to the queue.

- **Parameters**:
  - `data`: The item to queue
  - `priority`: `"high"`, `"medium"`, or `"low"` (default: `"medium"`)
- **Returns**: `QueueItem<T>` with metadata (`data`, `priority`, `enqueuedAt`, `id`)
- **Time complexity**: O(1)

```typescript
const queue = createPriorityQueue<number>();
const item = queue.enqueue(42, "high");

console.log(item); // { data: 42, priority: "high", enqueuedAt: 1712345678901, id: "q_1" }
```

### `dequeue()`

Removes and returns the highest-priority item.

- **Returns**: `QueueItem<T> | undefined`
- **Time complexity**: O(1)

### `peek()`

Returns the next item without removing it.

- **Returns**: `QueueItem<T> | undefined`
- **Time complexity**: O(1)

### `size` & `isEmpty`

Accessors for queue state.

```typescript
const queue = createPriorityQueue<string>();

console.log(queue.size);      // 0
console.log(queue.isEmpty);   // true

queue.enqueue("item");

console.log(queue.size);      // 1
console.log(queue.isEmpty);   // false
```

### `toArray()`

Returns all items in dequeue order (snapshot).

- **Returns**: `readonly QueueItem<T>[]`
- Does not modify the queue

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("c", "low");
queue.enqueue("a", "high");
queue.enqueue("b", "medium");

console.log(queue.toArray().map(i => i.data)); // ["a", "b", "c"]
```

### `clear()`

Removes all items from the queue.

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("item");
queue.clear();
console.log(queue.size); // 0
```

## Item Management

### `remove(id)`

Removes a specific item by ID.

- **Returns**: `boolean` (`true` if found and removed)
- **Time complexity**: O(n) (due to linear search)

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("remove-me");
queue.enqueue("keep-me");

console.log(queue.remove(item.id)); // true
console.log(queue.size);            // 1
console.log(queue.dequeue()?.data); // "keep-me"
```

### `updatePriority(id, newPriority)`

Changes an item's priority.

- **Returns**: `boolean` (`true` if item found)
- Preserves `data` and `enqueuedAt`; appends to new priority bucket

```typescript
const queue = createPriorityQueue<string>();
const item = queue.enqueue("task", "low");
queue.enqueue("other", "high");

console.log(queue.toArray().map(i => i.priority)); // ["high", "low"]

queue.updatePriority(item.id, "high");
console.log(queue.toArray().map(i => i.priority)); // ["high", "high"]
```

### `moveBefore(itemId, beforeItemId)`

Reorders items within the same priority bucket.

- **Returns**: `boolean` (`true` if move succeeded)
- Both items must exist and share the same priority

```typescript
const queue = createPriorityQueue<string>();
const a = queue.enqueue("first");
const b = queue.enqueue("second");
const c = queue.enqueue("third");

queue.moveBefore(c.id, a.id);
console.log(queue.toArray().map(i => i.data)); // ["third", "first", "second"]
```

### `moveToEnd(itemId)`

Moves an item to the end of its priority bucket.

- **Returns**: `boolean` (`true` if item found)
- No-op if already at end

```typescript
const queue = createPriorityQueue<string>();
queue.enqueue("first");
queue.enqueue("second");
const last = queue.enqueue("third");

queue.moveToEnd(last.id); // No change (already at end)
console.log(queue.toArray().map(i => i.data)); // ["first", "second", "third"]
```

## Observer Pattern

### `onEnqueue(callback)`

Registers a listener for new items.

- **Returns**: Unsubscribe function

```typescript
const queue = createPriorityQueue<string>();
const handler = (item) => {
  console.log("Enqueued:", item.data, "at", item.enqueuedAt);
};

const unsubscribe = queue.onEnqueue(handler);

queue.enqueue("test"); // Logs the enqueue event
unsubscribe();
queue.enqueue("ignored"); // Not logged
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