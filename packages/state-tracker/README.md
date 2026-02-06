# @hardlydifficult/state-tracker

File-based state persistence for recovery across restarts.

## Installation

```bash
npm install @hardlydifficult/state-tracker
```

## Quick Start

```typescript
import { StateTracker } from '@hardlydifficult/state-tracker';

const tracker = new StateTracker({ key: 'last-sync', default: 0 });

// Load persisted value (or default on first run)
const lastSync = tracker.load();

// Save updated value (atomic write)
tracker.save(Date.now());
```

## Options

| Option | Description |
|--------|-------------|
| `key` | Unique identifier for the state file (alphanumeric, hyphens, underscores) |
| `default` | Default value returned when no state exists (also sets the type) |
| `stateDirectory?` | Custom directory for state files (default: `~/.app-state` or `STATE_TRACKER_DIR` env) |

## Features

- **Type inference** from the default value
- **Atomic writes** via temp file + rename to prevent corruption
- **Key sanitization** to prevent path traversal
