import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface StateTrackerOptions<T> {
  key: string;
  default: T;
  stateDirectory?: string;
}

export class StateTracker<T> {
  private readonly filePath: string;
  private readonly defaultValue: T;

  private static sanitizeKey(key: string): string {
    const trimmed = key.trim();
    if (trimmed === '') {
      throw new Error('StateTracker key must be a non-empty string');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      throw new Error(
        'StateTracker key contains invalid characters (only alphanumeric, hyphens, and underscores allowed)',
      );
    }
    return trimmed;
  }

  private static getDefaultStateDirectory(): string {
    const envDir = process.env.STATE_TRACKER_DIR;
    if (envDir !== undefined && envDir !== '') {
      return envDir;
    }
    return path.join(os.homedir(), '.app-state');
  }

  constructor(options: StateTrackerOptions<T>) {
    const sanitizedKey = StateTracker.sanitizeKey(options.key);
    this.defaultValue = options.default;
    const stateDirectory = options.stateDirectory ?? StateTracker.getDefaultStateDirectory();

    if (!fs.existsSync(stateDirectory)) {
      fs.mkdirSync(stateDirectory, { recursive: true });
    }
    this.filePath = path.join(stateDirectory, `${sanitizedKey}.json`);
  }

  load(): T {
    if (!fs.existsSync(this.filePath)) {
      return this.defaultValue;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(data) as Record<string, unknown>;
      const { value } = state;
      if (value === undefined) {
        return this.defaultValue;
      }
      return value as T;
    } catch {
      return this.defaultValue;
    }
  }

  save(value: T): void {
    const state: Record<string, unknown> = {
      value,
      lastUpdated: new Date().toISOString(),
    };
    const tempFilePath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFilePath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempFilePath, this.filePath);
  }

  getFilePath(): string {
    return this.filePath;
  }
}
