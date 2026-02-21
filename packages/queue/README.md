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

queue.enqueue("low-priority-task", "low");
queue.enqueue("critical-task", "high");
queue.enqueue("default-task"); // defaults to 'medium' priority

console.log(queue.dequeue()?.data); // "critical-task"
console.log(queue.dequeue()?.data); // "default-task"
console.log(queue.dequeue()?.data); // "low-priority-task"
```

## Core API

### createPriorityQueue<T>()

Creates a new priority queue instance.

```typescript
import { createPriorityQueue } from "@hardlydifficult/queue";

const queue = createPriorityQueue<string>();
```

### PriorityQueue<T> Methods

| Method | Description |
|--------|-------------|
| `enqueue(data, priority?)` | Add an item to the queue (default priority: `"medium"`) |
| `dequeue()` | Remove and return the highest-priority item (FIFO within same priority) |
| `peek()` | View the next item without removing it |
| `remove(id)` | Remove a specific item by its ID |
| `size` | Number of items in the queue |
| `isEmpty` | Whether the queue is empty |
| `onEnqueue(callback)` | Register a callback for enqueue events |
| `toArray()` | Get all items in dequeue order as an array |
| `clear()` | Remove all items from the queue |
| `updatePriority(id, newPriority)` | Change an item's priority |
| `moveBefore(itemId, beforeItemId)` | Move an item before another in its priority bucket |
| `moveToEnd(itemId)` | Move an item to the end of its priority bucket |

### QueueItem<T>

Represents an item in the queue with metadata:

```typescript
interface QueueItem<T> {
  data: T;
  priority: "high" | "medium" | "low";
  enqueuedAt: number;
  id: string;
}
```

### Priority Levels

Items are dequeued in priority order: `high` → `medium` → `low`. Within the same priority, items follow FIFO (first-in-first-out) order.

## Observer Pattern

Register callbacks to be notified when items are enqueued:

```typescript
const queue = createPriorityQueue<string>();

const unsubscribe = queue.onEnqueue((item) => {
  console.log(`Enqueued item: ${item.data}`);
});

queue.enqueue("new task");

unsubscribe(); // stop notifications
```

## Priority Manipulation

Update priority and reorder items after enqueue:

```typescript
const queue = createPriorityQueue<string>();

const a = queue.enqueue("task-a", "low");
queue.enqueue("task-b", "low");
queue.enqueue("task-c", "low");

// Move 'task-a' to high priority
queue.updatePriority(a.id, "high");

// Move 'task-c' before 'task-b' in the low bucket
queue.moveBefore(queue.toArray()[2].id, queue.toArray()[1].id);
```

## Reference

### Priority Order

| Priority | Dequeue Order |
|----------|---------------|
| `"high"` | First |
| `"medium"` | Second |
| `"low"` | Last |

### Time Complexity

- `enqueue`: O(1)
- `dequeue`: O(1)
- `remove`, `updatePriority`, `moveBefore`, `moveToEnd`: O(n)
- `toArray`, `peek`: O(1)