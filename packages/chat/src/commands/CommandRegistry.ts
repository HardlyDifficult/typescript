/**
 * Command registry with conflict detection and auto-parsing
 *
 * Commands declare their argument shape via `args` and the registry
 * auto-generates the parse function. Longest-prefix-first matching
 * ensures unambiguous command resolution.
 */

import type { Command, CoreBotState, ParseResult } from "./types";

export interface RegisteredCommand<
  TState extends CoreBotState = CoreBotState,
> extends Command<TState> {
  readonly agentName: string;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a parse function from a command's ArgShape declaration.
 */
function buildParser(
  command: Pick<Command, "prefix" | "args" | "usage">
): (normalizedInput: string, originalInput: string) => ParseResult | null {
  const { prefix, args, usage } = command;
  const usageStr = usage ?? prefix;

  switch (args.type) {
    case "none": {
      const escaped = escapeRegex(prefix);
      const regex = new RegExp(`^!?${escaped}$`);
      return (normalizedInput) => {
        if (regex.test(normalizedInput)) {
          return { valid: true, args: {} };
        }
        return null;
      };
    }

    case "rest": {
      const { argName, optional } = args;
      const escaped = escapeRegex(prefix);
      const prefixRegex = new RegExp(`^!?${escaped}\\s+(.+)$`);
      const bareRegex = new RegExp(`^!?${escaped}$`);

      return (normalizedInput, originalInput) => {
        const match = prefixRegex.exec(normalizedInput);
        if (match) {
          // Extract from originalInput to preserve case
          const originalMatch = new RegExp(`^!?\\S+\\s+(.+)$`).exec(
            originalInput
          );
          const value = originalMatch?.[1].trim() ?? match[1].trim();
          return { valid: true, args: { [argName]: value } };
        }

        if (bareRegex.test(normalizedInput)) {
          if (optional === true) {
            return { valid: true, args: { [argName]: "" } };
          }
          return { valid: false, error: `Usage: ${usageStr}` };
        }

        return null;
      };
    }

    case "custom":
      return args.parse;

    default:
      throw new Error(`Unknown arg type: ${(args as { type: string }).type}`);
  }
}

/** Command registry with conflict detection, auto-parsing, and longest-prefix-first matching. */
export class CommandRegistry<TState extends CoreBotState = CoreBotState> {
  private readonly commands: RegisteredCommand<TState>[] = [];
  private readonly parsers = new Map<
    string,
    (n: string, o: string) => ParseResult | null
  >();

  /**
   * Register a command, checking for prefix conflicts.
   */
  register(agentName: string, command: Command<TState>): void {
    for (const existing of this.commands) {
      if (this.prefixesConflict(existing.prefix, command.prefix)) {
        const error =
          `Command prefix conflict: "${command.prefix}" (${agentName}) ` +
          `conflicts with "${existing.prefix}" (${existing.agentName})`;
        throw new Error(error);
      }
    }

    this.commands.push({ ...command, agentName });
    this.parsers.set(command.prefix, buildParser(command));
  }

  /**
   * Find the command that matches the input, trying longest prefix first.
   */
  match(
    input: string
  ): { command: RegisteredCommand<TState>; parsed: ParseResult } | null {
    const normalizedInput = input.toLowerCase();

    // Sort by prefix length descending for longest-match-first
    const sorted = [...this.commands].sort(
      (a, b) => b.prefix.length - a.prefix.length
    );

    for (const command of sorted) {
      const parse = this.parsers.get(command.prefix);
      if (parse === undefined) {
        continue;
      }
      const parsed = parse(normalizedInput, input);
      if (parsed !== null) {
        return { command, parsed };
      }
    }

    return null;
  }

  /**
   * Get all commands grouped by agent for help generation.
   */
  getCommandsByAgent(): Map<string, RegisteredCommand<TState>[]> {
    const byAgent = new Map<string, RegisteredCommand<TState>[]>();
    for (const cmd of this.commands) {
      const list = byAgent.get(cmd.agentName) ?? [];
      list.push(cmd);
      byAgent.set(cmd.agentName, list);
    }
    return byAgent;
  }

  /**
   * Get all registered commands.
   */
  getAllCommands(): readonly RegisteredCommand<TState>[] {
    return this.commands;
  }

  /**
   * Check if two prefixes conflict (one is prefix of the other).
   */
  private prefixesConflict(a: string, b: string): boolean {
    if (a === b) {
      return true;
    }
    // "merge" and "merge all" conflict, but "prs" and "push" don't
    return a.startsWith(`${b} `) || b.startsWith(`${a} `);
  }
}
