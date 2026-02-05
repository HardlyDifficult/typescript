# @hardlydifficult/state

File-based state persistence for recovering across process restarts.

## Installation

```bash
npm install @hardlydifficult/state
```

## Usage

### StateTracker

Simple key-value state persistence with automatic file management.

```typescript
import { StateTracker } from '@hardlydifficult/state';

// Create a tracker for numeric state
const tracker = new StateTracker({
  key: 'myapp-offset',
  propertyName: 'lastOffset', // optional, defaults to 'value'
  stateDirectory: '/path/to/state', // optional, defaults to ~/.app-state
  verbose: true, // optional, log save operations
});

// Load with a default value
const offset = tracker.load(0);

// Save state
tracker.save(100);

// Get the file path (for debugging)
console.log(tracker.getFilePath());
```

### SyncStateTracker

Advanced state tracking for sync operations with reset detection.

```typescript
import { SyncStateTracker } from '@hardlydifficult/state';

const tracker = new SyncStateTracker({
  namespace: 'myapp',
  key: 'mainnet-sync',
  stateDirectory: '/path/to/state', // optional, defaults to ~/.sync-state
});

// Get current state (null if no state exists)
const state = tracker.getState();

// Determine starting offset with reset detection
const currentEnd = await getCurrentEnd();
const result = tracker.getStartingOffset(currentEnd);
if (result === null) {
  // No previous state, start from beginning
} else if (result.wasReset) {
  // Data was reset, starting from 0
} else {
  // Resume from previous offset
  console.log(`Resuming from offset ${result.offset}`);
}

// Update state after successful sync
tracker.updateState(newOffset, currentEnd, {
  // optional metadata
  hostname: 'server-1',
});

// Clear state (for testing)
tracker.clear();
```

## Environment Variables

- `STATE_TRACKER_DIR` - Override default directory for StateTracker (~/.app-state)
- `SYNC_STATE_DIR` - Override default directory for SyncStateTracker (~/.sync-state)

## Features

- **Atomic writes**: SyncStateTracker uses temp file + rename to prevent corruption
- **Reset detection**: Detects when the source data has been reset
- **Graceful degradation**: Handles non-writable directories without throwing
- **Path traversal protection**: Rejects keys with invalid path characters
