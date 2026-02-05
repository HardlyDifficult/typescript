import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SyncStateTracker } from '../src/SyncStateTracker.js';

describe('SyncStateTracker', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-state-test-'));
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create state directory if not exists', () => {
      const stateDir = path.join(testDir, 'nested', 'sync');
      expect(fs.existsSync(stateDir)).toBe(false);

      new SyncStateTracker({ namespace: 'app', key: 'main', stateDirectory: stateDir });

      expect(fs.existsSync(stateDir)).toBe(true);
    });

    it('should report writable when directory can be created', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      expect(tracker.isWritable()).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return null when no state file exists', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      expect(tracker.getState()).toBeNull();
    });

    it('should return saved state', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(100, 200);

      const state = tracker.getState();
      expect(state).not.toBeNull();
      expect(state?.lastSuccessfulOffset).toBe(100);
      expect(state?.endAtSync).toBe(200);
      expect(state?.lastUpdated).toBeDefined();
    });

    it('should cache state after first load', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(100, 200);

      // First call loads from disk
      const state1 = tracker.getState();
      // Modify file directly
      const filePath = tracker.getStateFilePath();
      const modified = { ...state1, lastSuccessfulOffset: 999 };
      fs.writeFileSync(filePath, JSON.stringify(modified));

      // Second call should return cached value
      const state2 = tracker.getState();
      expect(state2?.lastSuccessfulOffset).toBe(100); // Cached, not 999
    });

    it('should return null for invalid state file', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      const filePath = tracker.getStateFilePath();
      fs.writeFileSync(filePath, JSON.stringify({ invalid: 'structure' }));

      expect(tracker.getState()).toBeNull();
    });
  });

  describe('updateState', () => {
    it('should save state with default metadata', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(500, 1000);

      const filePath = tracker.getStateFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;

      expect(content.lastSuccessfulOffset).toBe(500);
      expect(content.endAtSync).toBe(1000);
      expect(content.lastUpdated).toBeDefined();
      expect(content.metadata).toBeDefined();
    });

    it('should save state with custom metadata', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(500, 1000, { source: 'test', version: 1 });

      const state = tracker.getState();
      expect(state?.metadata).toEqual({ source: 'test', version: 1 });
    });

    it('should use atomic writes (temp file then rename)', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });

      // Update state
      tracker.updateState(100, 200);

      // Temp file should not exist after successful write
      const tempPath = tracker.getStateFilePath() + '.tmp';
      expect(fs.existsSync(tempPath)).toBe(false);

      // Main file should exist
      expect(fs.existsSync(tracker.getStateFilePath())).toBe(true);
    });
  });

  describe('getStartingOffset', () => {
    it('should return null when no state exists', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      expect(tracker.getStartingOffset(1000)).toBeNull();
    });

    it('should detect reset when offset > currentEnd', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(1000, 2000);

      // Clear cache to force reload
      tracker.clear();
      tracker.updateState(1000, 2000);

      // Now simulate a reset where current end is less than saved offset
      const result = tracker.getStartingOffset(500);
      expect(result).toEqual({ offset: 0, wasReset: true });
    });

    it('should return safe offset (offset - 1) for normal case', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(100, 200);

      const result = tracker.getStartingOffset(300);
      expect(result).toEqual({ offset: 99, wasReset: false });
    });

    it('should return 0 when offset - 1 would be negative', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(0, 100);

      const result = tracker.getStartingOffset(200);
      expect(result).toEqual({ offset: 0, wasReset: false });
    });
  });

  describe('clear', () => {
    it('should remove state file', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(100, 200);
      expect(fs.existsSync(tracker.getStateFilePath())).toBe(true);

      tracker.clear();
      expect(fs.existsSync(tracker.getStateFilePath())).toBe(false);
    });

    it('should clear cached state', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      tracker.updateState(100, 200);
      expect(tracker.getState()).not.toBeNull();

      tracker.clear();
      expect(tracker.getState()).toBeNull();
    });

    it('should not throw when file does not exist', () => {
      const tracker = new SyncStateTracker({
        namespace: 'app',
        key: 'main',
        stateDirectory: testDir,
      });
      expect(() => tracker.clear()).not.toThrow();
    });
  });

  describe('getStateFilePath', () => {
    it('should return correct file path', () => {
      const tracker = new SyncStateTracker({
        namespace: 'myapp',
        key: 'mainnet',
        stateDirectory: testDir,
      });
      expect(tracker.getStateFilePath()).toBe(path.join(testDir, 'myapp-mainnet.json'));
    });
  });

  describe('persistence across instances', () => {
    it('should persist state across different tracker instances', () => {
      const tracker1 = new SyncStateTracker({
        namespace: 'app',
        key: 'shared',
        stateDirectory: testDir,
      });
      tracker1.updateState(12345, 50000);

      const tracker2 = new SyncStateTracker({
        namespace: 'app',
        key: 'shared',
        stateDirectory: testDir,
      });
      const state = tracker2.getState();

      expect(state?.lastSuccessfulOffset).toBe(12345);
      expect(state?.endAtSync).toBe(50000);
    });
  });
});
