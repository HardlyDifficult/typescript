import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandDispatcher } from "../src/commands/CommandDispatcher.js";
import { CommandRegistry } from "../src/commands/CommandRegistry.js";
import type { Command, CoreBotState } from "../src/commands/types.js";

// ── helpers ────────────────────────────────────────────────────────────────

function makeMessage(
  content: string,
  opts: { username?: string; userId?: string; id?: string } = {}
) {
  return {
    content,
    author: {
      username: opts.username ?? "owner",
      id: opts.userId ?? "user-001",
    },
    id: opts.id ?? "msg-001",
    channelId: "ch-001",
    delete: vi.fn().mockResolvedValue(undefined),
    startThread: vi
      .fn()
      .mockResolvedValue({ id: "thread-001", channelId: "ch-001" }),
  };
}

function makeChannel() {
  return {
    beginTyping: vi.fn(),
    endTyping: vi.fn(),
    postMessage: vi
      .fn()
      .mockResolvedValue({ id: "resp-001", channelId: "ch-001" }),
    postDismissable: vi
      .fn()
      .mockResolvedValue({ id: "resp-001", channelId: "ch-001" }),
  };
}

function makeState(): CoreBotState {
  return { inFlightCommands: new Set<string>() };
}

function makeCommand(
  prefix: string,
  execute: Command["execute"] = vi.fn().mockResolvedValue(undefined)
): Command {
  return {
    prefix,
    description: `${prefix} command`,
    args: { type: "none" },
    execute,
  };
}

// ── CommandRegistry ────────────────────────────────────────────────────────

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe("none type", () => {
    beforeEach(() => {
      registry.register("meta", makeCommand("help"));
    });

    it("matches exact input", () => {
      const result = registry.match("help");
      expect(result).not.toBeNull();
      expect(result?.command.prefix).toBe("help");
      expect(result?.parsed).toEqual({ valid: true, args: {} });
    });

    it("matches with ! prefix", () => {
      const result = registry.match("!help");
      expect(result).not.toBeNull();
      expect(result?.parsed).toEqual({ valid: true, args: {} });
    });

    it("matches case-insensitively", () => {
      expect(registry.match("HELP")).not.toBeNull();
      expect(registry.match("Help")).not.toBeNull();
      expect(registry.match("hElP")).not.toBeNull();
    });

    it("does not match input with trailing arguments", () => {
      expect(registry.match("help me")).toBeNull();
      expect(registry.match("help!")).toBeNull();
    });

    it("does not match a longer word starting with the prefix", () => {
      expect(registry.match("helpfulness")).toBeNull();
    });

    it("returns null for unrecognized input", () => {
      expect(registry.match("unknown")).toBeNull();
      expect(registry.match("")).toBeNull();
    });
  });

  describe("rest type", () => {
    beforeEach(() => {
      registry.register("agent", {
        prefix: "task",
        description: "run a task",
        args: { type: "rest", argName: "prompt" },
        execute: vi.fn(),
      });
    });

    it("captures text after prefix", () => {
      const result = registry.match("task do this");
      expect(result).not.toBeNull();
      expect(result?.parsed).toEqual({
        valid: true,
        args: { prompt: "do this" },
      });
    });

    it("preserves original case in the captured arg", () => {
      const result = registry.match("task Do This");
      expect(result).not.toBeNull();
      expect(result?.parsed).toEqual({
        valid: true,
        args: { prompt: "Do This" },
      });
    });

    it("returns parse error when prefix is bare and not optional", () => {
      const result = registry.match("task");
      expect(result).not.toBeNull();
      expect(result?.parsed.valid).toBe(false);
    });

    it("returns empty string arg when bare and optional", () => {
      registry = new CommandRegistry();
      registry.register("agent", {
        prefix: "task",
        description: "run a task",
        args: { type: "rest", argName: "prompt", optional: true },
        execute: vi.fn(),
      });
      const result = registry.match("task");
      expect(result).not.toBeNull();
      expect(result?.parsed).toEqual({ valid: true, args: { prompt: "" } });
    });
  });

  describe("custom type", () => {
    it("delegates to the provided parse function", () => {
      const parse = vi.fn().mockReturnValue({ valid: true, args: { x: 1 } });
      registry.register("agent", {
        prefix: "custom",
        description: "custom command",
        args: { type: "custom", parse },
        execute: vi.fn(),
      });
      const result = registry.match("custom foo");
      expect(parse).toHaveBeenCalled();
      expect(result?.parsed).toEqual({ valid: true, args: { x: 1 } });
    });
  });

  describe("conflict detection", () => {
    it("throws on duplicate prefix", () => {
      registry.register("a", makeCommand("help"));
      expect(() => registry.register("b", makeCommand("help"))).toThrow(
        /prefix conflict/i
      );
    });

    it("throws when one prefix is a space-separated sub-prefix of another", () => {
      registry.register("a", makeCommand("workflow"));
      expect(() =>
        registry.register("b", makeCommand("workflow start"))
      ).toThrow(/prefix conflict/i);
    });

    it("does not throw for prefixes that share a common substring without a space boundary", () => {
      registry.register("a", makeCommand("scan"));
      expect(() =>
        registry.register("b", makeCommand("scanner"))
      ).not.toThrow();
    });
  });

  describe("getCommandsByAgent", () => {
    it("groups commands under their agent names", () => {
      registry.register("meta", makeCommand("help"));
      registry.register("meta", makeCommand("cancel"));
      registry.register("ai", makeCommand("ask"));

      const byAgent = registry.getCommandsByAgent();
      expect([...byAgent.keys()]).toEqual(["meta", "ai"]);
      expect(byAgent.get("meta")?.map((c) => c.prefix)).toEqual([
        "help",
        "cancel",
      ]);
      expect(byAgent.get("ai")?.map((c) => c.prefix)).toEqual(["ask"]);
    });
  });

  describe("longest-prefix-first matching", () => {
    it("tries longer prefixes first when multiple could match", () => {
      // "wf approve" (10 chars) and "wf status" (9 chars) don't conflict with each other
      // (no space-boundary overlap). Sorting ensures the longer one is tried first.
      registry.register("a", {
        prefix: "wf approve",
        description: "approve",
        args: { type: "none" },
        execute: vi.fn(),
      });
      registry.register("b", {
        prefix: "wf status",
        description: "status",
        args: { type: "none" },
        execute: vi.fn(),
      });

      expect(registry.match("wf approve")?.command.prefix).toBe("wf approve");
      expect(registry.match("wf status")?.command.prefix).toBe("wf status");
      expect(registry.match("wf")).toBeNull();
    });
  });
});

// ── CommandDispatcher ──────────────────────────────────────────────────────

describe("CommandDispatcher", () => {
  let registry: CommandRegistry;
  let channel: ReturnType<typeof makeChannel>;
  let state: CoreBotState;

  beforeEach(() => {
    registry = new CommandRegistry();
    channel = makeChannel();
    state = makeState();
  });

  function makeDispatcher(opts: { ownerUsername?: string } = {}) {
    return new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: opts.ownerUsername ?? "owner",
    });
  }

  it("dispatches a recognized command to execute()", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    registry.register("meta", { ...makeCommand("help"), execute });

    const dispatcher = makeDispatcher();
    await dispatcher.handleMessage(makeMessage("help") as never);

    expect(execute).toHaveBeenCalledOnce();
  });

  it("dispatches case-insensitively (HELP → help command)", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    registry.register("meta", { ...makeCommand("help"), execute });

    await makeDispatcher().handleMessage(makeMessage("HELP") as never);

    expect(execute).toHaveBeenCalledOnce();
  });

  it("calls onUnrecognized for unknown input", async () => {
    const onUnrecognized = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      onUnrecognized,
    });

    await dispatcher.handleMessage(makeMessage("unknown command") as never);

    expect(onUnrecognized).toHaveBeenCalledWith(
      "unknown command",
      expect.any(Object)
    );
  });

  it("sends dismissable error when execute() throws (the help bug fix)", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("Discord API error"));
    registry.register("meta", { ...makeCommand("help"), execute });

    // ownerUserId must be set so postDismissable is used
    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      ownerUserId: "user-001",
    });

    await dispatcher.handleMessage(makeMessage("help") as never);

    expect(channel.postDismissable).toHaveBeenCalledWith(
      "Command failed: Discord API error",
      "user-001"
    );
  });

  it("sends dismissable error for non-Error thrown values", async () => {
    const execute = vi.fn().mockRejectedValue("oops");
    registry.register("meta", { ...makeCommand("help"), execute });

    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      ownerUserId: "user-001",
    });

    await dispatcher.handleMessage(makeMessage("help") as never);

    expect(channel.postDismissable).toHaveBeenCalledWith(
      "Command failed: oops",
      "user-001"
    );
  });

  it("ignores messages from non-owner users", async () => {
    const execute = vi.fn();
    registry.register("meta", { ...makeCommand("help"), execute });

    await makeDispatcher({ ownerUsername: "owner" }).handleMessage(
      makeMessage("help", { username: "someone-else" }) as never
    );

    expect(execute).not.toHaveBeenCalled();
  });

  it("de-duplicates in-flight commands", async () => {
    let resolveFirst!: () => void;
    const firstDone = new Promise<void>((res) => {
      resolveFirst = res;
    });
    const execute = vi
      .fn()
      .mockImplementationOnce(() => firstDone)
      .mockResolvedValue(undefined);

    registry.register("meta", { ...makeCommand("help"), execute });
    const dispatcher = makeDispatcher();

    // First call starts executing
    const first = dispatcher.handleMessage(makeMessage("help") as never);
    // Second call arrives while first is in-flight — should be skipped
    await dispatcher.handleMessage(makeMessage("help") as never);

    resolveFirst();
    await first;

    expect(execute).toHaveBeenCalledOnce();
  });

  it("captures owner userId from the first message", async () => {
    const onOwnerIdCaptured = vi.fn();
    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      onOwnerIdCaptured,
    });

    await dispatcher.handleMessage(
      makeMessage("hello", { userId: "uid-42" }) as never
    );

    expect(onOwnerIdCaptured).toHaveBeenCalledWith("uid-42");
  });

  it("deletes the user's message after execution", async () => {
    registry.register("meta", makeCommand("help"));
    const msg = makeMessage("help");

    await makeDispatcher().handleMessage(msg as never);

    expect(msg.delete).toHaveBeenCalledOnce();
  });

  it("deletes the message even when execute() throws", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("boom"));
    registry.register("meta", { ...makeCommand("help"), execute });
    const msg = makeMessage("help");

    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      ownerUserId: "user-001",
    });
    await dispatcher.handleMessage(msg as never);

    expect(msg.delete).toHaveBeenCalledOnce();
  });

  it("sends a parse error message for invalid args", async () => {
    registry.register("agent", {
      prefix: "task",
      description: "run a task",
      args: { type: "rest", argName: "prompt" },
      execute: vi.fn(),
    });

    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      ownerUserId: "user-001",
    });

    // "task" without args → parse error
    await dispatcher.handleMessage(makeMessage("task") as never);

    expect(channel.postDismissable).toHaveBeenCalledWith(
      expect.stringContaining("Usage"),
      "user-001"
    );
  });

  it("skips empty input (line 79-81)", async () => {
    const execute = vi.fn();
    registry.register("meta", makeCommand("help"));
    const dispatcher = makeDispatcher();

    // Empty content (e.g., voice message) - should not execute any command
    const msg = makeMessage("");
    await dispatcher.handleMessage(msg as never);

    expect(execute).not.toHaveBeenCalled();
    // Still calls endTyping after completeInFlight
    expect(channel.endTyping).toHaveBeenCalled();
  });

  it("calls onParseError callback when provided", async () => {
    registry.register("agent", {
      prefix: "task",
      description: "run a task",
      args: { type: "rest", argName: "prompt" },
      execute: vi.fn(),
    });

    const onParseError = vi.fn();
    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      onParseError,
    });

    await dispatcher.handleMessage(makeMessage("task") as never);

    expect(onParseError).toHaveBeenCalledWith(expect.stringContaining("Usage"));
  });

  it("sendDismissable uses postMessage when ownerId is undefined (line 129)", async () => {
    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      // no ownerUserId
    });

    // Use a message with no author.id to prevent ownerUserId from being captured
    const msg = {
      content: "unknown",
      author: { username: "owner", id: undefined },
      id: "msg-001",
      channelId: "ch-001",
      delete: vi.fn().mockResolvedValue(undefined),
      startThread: vi.fn().mockResolvedValue({ id: "thread-001", channelId: "ch-001" }),
    };
    await dispatcher.handleMessage(msg as never);

    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.stringContaining("Unrecognized command")
    );
    expect(channel.postDismissable).not.toHaveBeenCalled();
  });

  it("createContext functions: send, sendMessage, sendDismissable, sendFile, startThread", async () => {
    const capturedCtx: Record<string, unknown> = {};
    const execute = vi.fn().mockImplementation(async (ctx: Record<string, unknown>) => {
      capturedCtx.ctx = ctx;
    });
    registry.register("meta", { ...makeCommand("help"), execute });

    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
      ownerUserId: "user-001",
    });

    const msg = makeMessage("help");
    await dispatcher.handleMessage(msg as never);

    expect(execute).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (execute.mock.calls[0] as any)[0];

    // Test send
    ctx.send("hello");
    expect(channel.postMessage).toHaveBeenCalledWith("hello");

    // Test sendMessage
    await ctx.sendMessage("world");
    expect(channel.postMessage).toHaveBeenCalledWith("world");

    // Test sendDismissable (with ownerId)
    await ctx.sendDismissable("warning");
    expect(channel.postDismissable).toHaveBeenCalledWith("warning", "user-001");

    // Test sendFile with string content
    ctx.sendFile("file content", "file.txt", "Optional message");
    expect(channel.postMessage).toHaveBeenCalledWith(
      "Optional message",
      expect.objectContaining({ files: [expect.objectContaining({ name: "file.txt" })] })
    );

    // Test sendFile with Buffer content
    ctx.sendFile(Buffer.from("buf"), "buf.bin");
    expect(channel.postMessage).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ files: [expect.objectContaining({ name: "buf.bin" })] })
    );
  });

  it("createContext.sendDismissable uses postMessage when no ownerId", async () => {
    const execute = vi.fn().mockImplementation(async (ctx: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as any).sendDismissable("message");
    });
    registry.register("meta", { ...makeCommand("help"), execute });

    // No ownerUserId, and message has no author.id to prevent auto-capture
    const dispatcher = new CommandDispatcher({
      channel: channel as never,
      registry,
      state,
      ownerUsername: "owner",
    });

    const msg = {
      content: "help",
      author: { username: "owner", id: undefined },
      id: "msg-001",
      channelId: "ch-001",
      delete: vi.fn().mockResolvedValue(undefined),
      startThread: vi.fn().mockResolvedValue({ id: "thread-001", channelId: "ch-001" }),
    };
    await dispatcher.handleMessage(msg as never);

    expect(channel.postMessage).toHaveBeenCalledWith("message");
  });

  it("createContext.startThread adds message to messagesWithThreads", async () => {
    const execute = vi.fn().mockImplementation(async (ctx: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as any).startThread("My Thread");
    });
    registry.register("meta", { ...makeCommand("help"), execute });

    const dispatcher = makeDispatcher();
    const msg = makeMessage("help");
    await dispatcher.handleMessage(msg as never);

    // When a thread is started, the message should NOT be deleted
    expect(msg.delete).not.toHaveBeenCalled();
  });
});

// ── CommandRegistry edge cases ──────────────────────────────────────────────

describe("CommandRegistry - additional coverage", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it("rest type: returns null when bare prefix doesn't match (line 69)", () => {
    registry.register("agent", {
      prefix: "task",
      description: "run a task",
      args: { type: "rest", argName: "prompt", optional: false },
      execute: vi.fn(),
    });

    // Input that doesn't match prefix at all
    const result = registry.match("other command");
    expect(result).toBeNull();
  });

  it("throws for unknown arg type (line 77)", () => {
    expect(() => {
      registry.register("agent", {
        prefix: "cmd",
        description: "test",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: { type: "unknown" } as any,
        execute: vi.fn(),
      });
    }).toThrow("Unknown arg type: unknown");
  });

  it("match() continues when parsers.get returns undefined (line 122)", () => {
    // Register a command normally
    registry.register("meta", makeCommand("help"));
    // Manually corrupt parsers by deleting an entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (registry as any).parsers.delete("help");

    // Should return null since parser is missing
    const result = registry.match("help");
    expect(result).toBeNull();
  });

  it("getAllCommands returns all registered commands (line 150)", () => {
    registry.register("meta", makeCommand("help"));
    registry.register("meta", makeCommand("cancel"));
    registry.register("ai", makeCommand("ask"));

    const all = registry.getAllCommands();
    expect(all).toHaveLength(3);
    expect(all.map((c) => c.prefix)).toEqual(["help", "cancel", "ask"]);
  });
});
