import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StateTracker } from '../src/StateTracker';

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

      new StateTracker({ key: 'test', default: 0, stateDirectory: stateDir });

      expect(fs.existsSync(stateDir)).toBe(true);
    });

    it('should reject keys with invalid characters', () => {
      expect(
        () => new StateTracker({ key: '../evil', default: 0, stateDirectory: testDir }),
      ).toThrow('invalid characters');
      expect(
        () => new StateTracker({ key: 'foo/bar', default: 0, stateDirectory: testDir }),
      ).toThrow('invalid characters');
      expect(
        () => new StateTracker({ key: 'foo\\bar', default: 0, stateDirectory: testDir }),
      ).toThrow('invalid characters');
      // Also reject special characters
      expect(
        () => new StateTracker({ key: 'foo.bar', default: 0, stateDirectory: testDir }),
      ).toThrow('invalid characters');
      expect(
        () => new StateTracker({ key: 'foo@bar', default: 0, stateDirectory: testDir }),
      ).toThrow('invalid characters');
    });

    it('should reject empty keys', () => {
      expect(() => new StateTracker({ key: '', default: 0, stateDirectory: testDir })).toThrow(
        'non-empty string',
      );
      expect(() => new StateTracker({ key: '   ', default: 0, stateDirectory: testDir })).toThrow(
        'non-empty string',
      );
    });
  });

  describe('load', () => {
    it('should return default value when no state file exists', () => {
      const tracker = new StateTracker({ key: 'test', default: 42, stateDirectory: testDir });
      const value = tracker.load();
      expect(value).toBe(42);
    });

    it('should load saved numeric value', () => {
      const tracker = new StateTracker({ key: 'test', default: 0, stateDirectory: testDir });
      tracker.save(100);

      const value = tracker.load();
      expect(value).toBe(100);
    });

    it('should always use value property in JSON file', () => {
      const tracker = new StateTracker({
        key: 'test',
        default: 0,
        stateDirectory: testDir,
      });
      tracker.save(200);

      // Verify the file uses "value" property
      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      expect(content.value).toBe(200);
    });

    it('should return default for corrupted JSON', () => {
      const tracker = new StateTracker({ key: 'test', default: 999, stateDirectory: testDir });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, 'not valid json{{{', 'utf-8');

      const value = tracker.load();
      expect(value).toBe(999);
    });

    it('should return default when value property is missing', () => {
      const tracker = new StateTracker({ key: 'test', default: 777, stateDirectory: testDir });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, JSON.stringify({ other: 'data' }), 'utf-8');

      const value = tracker.load();
      expect(value).toBe(777);
    });
  });

  describe('save', () => {
    it('should save numeric value', () => {
      const tracker = new StateTracker({ key: 'test', default: 0, stateDirectory: testDir });
      tracker.save(500);

      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      expect(content.value).toBe(500);
      expect(content.lastUpdated).toBeDefined();
    });

    it('should overwrite previous value', () => {
      const tracker = new StateTracker({ key: 'test', default: 0, stateDirectory: testDir });
      tracker.save(100);
      tracker.save(200);
      tracker.save(300);

      const value = tracker.load();
      expect(value).toBe(300);
    });
  });

  describe('type inference from default', () => {
    it('should infer string type from default', () => {
      const tracker = new StateTracker({
        key: 'string-test',
        default: 'default-value',
        stateDirectory: testDir,
      });
      tracker.save('hello world');

      const value = tracker.load();
      expect(value).toBe('hello world');
    });

    it('should infer object type from default', () => {
      const tracker = new StateTracker({
        key: 'object-test',
        default: { count: 0, name: '' },
        stateDirectory: testDir,
      });
      tracker.save({ count: 10, name: 'test' });

      const value = tracker.load();
      expect(value).toEqual({ count: 10, name: 'test' });
    });

    it('should infer array type from default', () => {
      const tracker = new StateTracker({
        key: 'array-test',
        default: [] as number[],
        stateDirectory: testDir,
      });
      tracker.save([1, 2, 3, 4, 5]);

      const value = tracker.load();
      expect(value).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('getFilePath', () => {
    it('should return correct file path', () => {
      const tracker = new StateTracker({ key: 'my-key', default: 0, stateDirectory: testDir });
      const filePath = tracker.getFilePath();

      expect(filePath).toBe(path.join(testDir, 'my-key.json'));
    });
  });

  describe('persistence across instances', () => {
    it('should persist state across different tracker instances', () => {
      const tracker1 = new StateTracker({ key: 'shared', default: 0, stateDirectory: testDir });
      tracker1.save(12345);

      const tracker2 = new StateTracker({ key: 'shared', default: 0, stateDirectory: testDir });
      const value = tracker2.load();

      expect(value).toBe(12345);
    });
  });

  describe('atomic write durability', () => {
    it('should not corrupt state file if temp file exists from interrupted write', () => {
      const tracker = new StateTracker({ key: 'durable', default: 0, stateDirectory: testDir });

      // Save initial value
      tracker.save(100);

      // Simulate a crashed write by leaving a temp file
      const tempFilePath = `${tracker.getFilePath()}.tmp`;
      fs.writeFileSync(tempFilePath, '{"value": 999, "lastUpdated": "corrupted"}', 'utf-8');

      // Load should return the committed value, not the temp file
      const value = tracker.load();
      expect(value).toBe(100);
    });
  });
});
