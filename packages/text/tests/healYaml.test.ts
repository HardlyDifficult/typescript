import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { healYaml } from "../src/healYaml";

describe("healYaml", () => {
  describe("markdown fence stripping", () => {
    it("should strip ```yaml fences", () => {
      const input = '```yaml\nkey: value\n```';
      expect(healYaml(input)).toBe("key: value");
    });

    it("should strip ``` fences without language tag", () => {
      const input = '```\nkey: value\n```';
      expect(healYaml(input)).toBe("key: value");
    });

    it("should handle input with no fences", () => {
      const input = "key: value";
      expect(healYaml(input)).toBe("key: value");
    });

    it("should trim whitespace", () => {
      const input = "  \n  key: value  \n  ";
      expect(healYaml(input)).toBe("key: value");
    });
  });

  describe("colon-in-value quoting", () => {
    it("should quote a plain scalar with a colon", () => {
      const input = "description: Development dependencies: Node types, TypeScript, and Vitest.";
      const result = healYaml(input);
      expect(result).toBe(
        'description: "Development dependencies: Node types, TypeScript, and Vitest."'
      );
    });

    it("should not quote values already in double quotes", () => {
      const input = 'description: "Already quoted: value"';
      expect(healYaml(input)).toBe('description: "Already quoted: value"');
    });

    it("should not quote values already in single quotes", () => {
      const input = "description: 'Already quoted: value'";
      expect(healYaml(input)).toBe("description: 'Already quoted: value'");
    });

    it("should not quote block scalar values", () => {
      const input = "description: |\n  Multi-line: value";
      expect(healYaml(input)).toBe("description: |\n  Multi-line: value");
    });

    it("should not quote folded scalar values", () => {
      const input = "description: >\n  Folded: value";
      expect(healYaml(input)).toBe("description: >\n  Folded: value");
    });

    it("should not quote flow sequence values", () => {
      const input = "items: [a: 1, b: 2]";
      expect(healYaml(input)).toBe("items: [a: 1, b: 2]");
    });

    it("should not quote flow mapping values", () => {
      const input = "item: {a: 1, b: 2}";
      expect(healYaml(input)).toBe("item: {a: 1, b: 2}");
    });

    it("should not quote values without colons", () => {
      const input = "description: Simple value without special chars";
      expect(healYaml(input)).toBe(
        "description: Simple value without special chars"
      );
    });

    it("should escape double quotes within the value", () => {
      const input = 'description: Uses "quoted" text: important';
      expect(healYaml(input)).toBe(
        'description: "Uses \\"quoted\\" text: important"'
      );
    });

    it("should handle indented keys in multi-line YAML", () => {
      const input = `key_sections:
  - lines: "1-10"
    label: main
    description: Core deps: Node types and TypeScript.`;
      const result = healYaml(input);
      expect(result).toContain(
        '    description: "Core deps: Node types and TypeScript."'
      );
      // Should not modify lines: or label:
      expect(result).toContain('  - lines: "1-10"');
      expect(result).toContain("    label: main");
    });
  });

  describe("real-world discord error cases", () => {
    it("should fix packages/collections/package.json summary", () => {
      const input = `purpose: |
  Defines package metadata, build/test configurations, and dependencies for the @hardlydifficult/collections TypeScript library.
key_sections:
  - lines: "7-13"
    label: scripts
    description: NPM scripts for building, testing, linting, and cleaning the project.
  - lines: "15-18"
    label: devDependencies
    description: Development dependencies: Node types, TypeScript, and Vitest.
  - lines: "20-22"
    label: engines
    description: Minimum Node.js version requirement (>=18.0.0).`;

      const healed = healYaml(input);
      // Should parse without error after healing
      const parsed = parseYaml(healed);
      expect(parsed.purpose).toContain("Defines package metadata");
      expect(parsed.key_sections).toHaveLength(3);
      expect(parsed.key_sections[1].description).toBe(
        "Development dependencies: Node types, TypeScript, and Vitest."
      );
    });

    it("should fix packages/poller/package.json summary", () => {
      const input = `purpose: |
  NPM package definition for a WebSocket-based polling utility that manages connections and message routing between processes.
key_sections:
  - lines: "1-8"
    label: package metadata
    description: Package name, version, entry points, and distributed files configuration.
  - lines: "9-15"
    label: scripts
    description: Build, test, lint, and clean commands using TypeScript and Vitest.
  - lines: "17-21"
    label: devDependencies
    description: Core dev dependencies: Node types, TypeScript compiler, and Vitest test runner.`;

      const healed = healYaml(input);
      const parsed = parseYaml(healed);
      expect(parsed.key_sections).toHaveLength(3);
      expect(parsed.key_sections[2].description).toBe(
        "Core dev dependencies: Node types, TypeScript compiler, and Vitest test runner."
      );
    });

    it("should fix packages/throttle/package.json summary", () => {
      const input = `purpose: |
  Throttling utility package for rate-limiting function calls with configurable delays and trailing options.
key_sections:
  - lines: "15-16"
    label: dependency
    description: Local peer dependency on @hardlydifficult/state-tracker for shared state management.
  - lines: "18-22"
    label: devDependencies
    description: Testing and linting stack: vitest, TypeScript 5.9, and Node types.
  - lines: "23-25"
    label: peerDependencies
    description: Declares compatible versions of state-tracker to avoid version conflicts.`;

      const healed = healYaml(input);
      const parsed = parseYaml(healed);
      expect(parsed.key_sections).toHaveLength(3);
      expect(parsed.key_sections[1].description).toBe(
        "Testing and linting stack: vitest, TypeScript 5.9, and Node types."
      );
    });

    it("should fix Pipeline.ts summary with multiple colon descriptions", () => {
      const input = `purpose: |
  Manages linear workflow execution with state persistence, hooks, gates, and crash recovery.
key_sections:
  - lines: "40-101"
    label: Constructor
    description: Validates steps, builds transitions, initializes WorkflowEngine with state persistence.
  - lines: "148-220"
    label: run / resume / cancel
    description: Lifecycle methods: executes pipeline, resumes from gates, or cancels via AbortController.
  - lines: "268-313"
    label: executeFrom
    description: Core loop: runs steps sequentially, handles gates (pauses), retries, and completion.
  - lines: "270-279"
    label: runnerDeps
    description: Aggregates dependencies (engine, hooks, logger, abort signal) for step execution.
  - lines: "294-297"
    label: Gate Handling
    description: Pauses execution at gate steps; requires external \`resume()\` call to continue.`;

      const healed = healYaml(input);
      const parsed = parseYaml(healed);
      expect(parsed.key_sections).toHaveLength(5);
      expect(parsed.key_sections[1].description).toBe(
        "Lifecycle methods: executes pipeline, resumes from gates, or cancels via AbortController."
      );
      expect(parsed.key_sections[2].description).toBe(
        "Core loop: runs steps sequentially, handles gates (pauses), retries, and completion."
      );
    });
  });

  describe("combined fixes", () => {
    it("should strip fences and quote colons together", () => {
      const input = `\`\`\`yaml
purpose: |
  Some purpose here.
key_sections:
  - lines: "1-10"
    label: main
    description: Main function: entry point for the application.
\`\`\``;

      const healed = healYaml(input);
      const parsed = parseYaml(healed);
      expect(parsed.purpose).toContain("Some purpose here");
      expect(parsed.key_sections[0].description).toBe(
        "Main function: entry point for the application."
      );
    });
  });
});
