import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StateTracker } from '../src/StateTracker.js';

describe('StateTracker', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-tracker-test-'));
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create state directory if not exists', () => {
      const stateDir = path.join(testDir, 'nested', 'state');
      expect(fs.existsSync(stateDir)).toBe(false);

      new StateTracker({ key: 'test', stateDirectory: stateDir });

      expect(fs.existsSync(stateDir)).toBe(true);
    });

    it('should reject keys with path traversal characters', () => {
      expect(() => new StateTracker({ key: '../evil', stateDirectory: testDir })).toThrow(
        'invalid path characters',
      );
      expect(() => new StateTracker({ key: 'foo/bar', stateDirectory: testDir })).toThrow(
        'invalid path characters',
      );
      expect(() => new StateTracker({ key: 'foo\\bar', stateDirectory: testDir })).toThrow(
        'invalid path characters',
      );
    });

    it('should reject empty keys', () => {
      expect(() => new StateTracker({ key: '', stateDirectory: testDir })).toThrow(
        'non-empty string',
      );
      expect(() => new StateTracker({ key: '   ', stateDirectory: testDir })).toThrow(
        'non-empty string',
      );
    });
  });

  describe('load', () => {
    it('should return default value when no state file exists', () => {
      const tracker = new StateTracker({ key: 'test', stateDirectory: testDir });
      const value = tracker.load(42);
      expect(value).toBe(42);
    });

    it('should load saved numeric value', () => {
      const tracker = new StateTracker({ key: 'test', stateDirectory: testDir });
      tracker.save(100);

      const value = tracker.load(0);
      expect(value).toBe(100);
    });

    it('should use custom property name', () => {
      const tracker = new StateTracker({
        key: 'test',
        stateDirectory: testDir,
        propertyName: 'lastOffset',
      });
      tracker.save(200);

      // Verify the file uses the custom property name
      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      expect(content.lastOffset).toBe(200);
      expect(content.value).toBeUndefined();
    });

    it('should return default for corrupted JSON', () => {
      const tracker = new StateTracker({ key: 'test', stateDirectory: testDir });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, 'not valid json{{{', 'utf-8');

      const value = tracker.load(999);
      expect(value).toBe(999);
    });

    it('should return default when property is missing', () => {
      const tracker = new StateTracker({ key: 'test', stateDirectory: testDir });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, JSON.stringify({ other: 'data' }), 'utf-8');

      const value = tracker.load(777);
      expect(value).toBe(777);
    });
  });

  describe('save', () => {
    it('should save numeric value', () => {
      const tracker = new StateTracker({ key: 'test', stateDirectory: testDir });
      tracker.save(500);

      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      expect(content.value).toBe(500);
      expect(content.lastUpdated).toBeDefined();
    });

    it('should overwrite previous value', () => {
      const tracker = new StateTracker({ key: 'test', stateDirectory: testDir });
      tracker.save(100);
      tracker.save(200);
      tracker.save(300);

      const value = tracker.load(0);
      expect(value).toBe(300);
    });
  });

  describe('generic types', () => {
    it('should save and load string values', () => {
      const tracker = new StateTracker<string>({ key: 'string-test', stateDirectory: testDir });
      tracker.save('hello world');

      const value = tracker.load('default');
      expect(value).toBe('hello world');
    });

    it('should save and load object values', () => {
      interface MyState {
        count: number;
        name: string;
      }
      const tracker = new StateTracker<MyState>({ key: 'object-test', stateDirectory: testDir });
      tracker.save({ count: 10, name: 'test' });

      const value = tracker.load({ count: 0, name: '' });
      expect(value).toEqual({ count: 10, name: 'test' });
    });

    it('should save and load array values', () => {
      const tracker = new StateTracker<number[]>({ key: 'array-test', stateDirectory: testDir });
      tracker.save([1, 2, 3, 4, 5]);

      const value = tracker.load([]);
      expect(value).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('getFilePath', () => {
    it('should return correct file path', () => {
      const tracker = new StateTracker({ key: 'my-key', stateDirectory: testDir });
      const filePath = tracker.getFilePath();

      expect(filePath).toBe(path.join(testDir, 'my-key.json'));
    });
  });

  describe('persistence across instances', () => {
    it('should persist state across different tracker instances', () => {
      const tracker1 = new StateTracker({ key: 'shared', stateDirectory: testDir });
      tracker1.save(12345);

      const tracker2 = new StateTracker({ key: 'shared', stateDirectory: testDir });
      const value = tracker2.load(0);

      expect(value).toBe(12345);
    });
  });
});
