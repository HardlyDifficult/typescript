# @hardlydifficult/state-tracker

File-based state persistence for recovering across process restarts.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Usage

```typescript
import { StateTracker } from '@hardlydifficult/state-tracker';

// Create a tracker - type is inferred from the default value
const tracker = new StateTracker({
  key: 'myapp-offset',
  default: 0,
  stateDirectory: '/path/to/state', // optional, defaults to ~/.app-state
});

// Load persisted state (returns default if none exists)
const offset = tracker.load();

// Save state
tracker.save(100);

// Get the file path (for debugging)
console.log(tracker.getFilePath());
```

### Type Inference

The type is automatically inferred from the `default` value you provide:

```typescript
// Track an object - type is inferred from the default
const tracker = new StateTracker({
  key: 'myapp-sync',
  default: { lastOffset: 0, endAtSync: 0 },
});

tracker.save({ lastOffset: 100, endAtSync: 500 });
const state = tracker.load(); // type: { lastOffset: number; endAtSync: number }
```

## Environment Variables

- `STATE_TRACKER_DIR` - Override default directory (~/.app-state)

## Durability Guarantee

StateTracker guarantees that **previously persisted state is never lost**, even if the process crashes at any point during operation.

### How It Works

The `save()` method uses atomic writes:

1. Write new state to a temporary file (`{key}.json.tmp`)
2. Atomically rename the temp file to the actual state file

The `rename()` system call is atomic on POSIX filesystems - it either completes fully or not at all. This means:

| Crash Point | Result |
|-------------|--------|
| Before or during temp file write | Original state file is untouched |
| After temp file write, before rename | Original state file is untouched |
| During rename | Atomic - either old or new state, never corrupted |
| After rename | New state is fully persisted |

### What This Means for Your Application

- **You will never lose state that was previously saved** - if your app crashes, the last successfully saved value is always recoverable
- **An in-progress save that didn't complete may be lost** - this is expected; if `save()` didn't finish, that update wasn't persisted
- **Corrupted or partial files are handled gracefully** - `load()` returns the default value if the state file is unreadable

## Features

- **Atomic writes**: Uses temp file + rename to prevent corruption
- **Path traversal protection**: Rejects keys with invalid path characters
- **Type inference**: Type is inferred from the default value
- **Crash-safe**: Previously persisted state is never lost
