# @hardlydifficult/state-tracker

File-based state persistence for recovering across process restarts.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Usage

```typescript
import { StateTracker } from '@hardlydifficult/state-tracker';

// Create a tracker for numeric state (e.g., an offset)
const tracker = new StateTracker({
  key: 'myapp-offset',
  propertyName: 'lastOffset', // optional, defaults to 'value'
  stateDirectory: '/path/to/state', // optional, defaults to ~/.app-state
});

// Load with a default value
const offset = tracker.load(0);

// Save state
tracker.save(100);

// Get the file path (for debugging)
console.log(tracker.getFilePath());
```

### Generic Types

StateTracker supports any JSON-serializable type:

```typescript
// Track an object
interface SyncState {
  lastOffset: number;
  endAtSync: number;
}

const tracker = new StateTracker<SyncState>({
  key: 'myapp-sync',
});

tracker.save({ lastOffset: 100, endAtSync: 500 });
const state = tracker.load({ lastOffset: 0, endAtSync: 0 });
```

## Environment Variables

- `STATE_TRACKER_DIR` - Override default directory (~/.app-state)

## Features

- **Atomic writes**: Uses temp file + rename to prevent corruption
- **Path traversal protection**: Rejects keys with invalid path characters
- **Generic types**: Store any JSON-serializable value
