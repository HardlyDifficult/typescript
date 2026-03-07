import type {
  ChannelMessageOptions,
  FileAttachment,
  MessageContent,
  MessageSendOptions,
  ReactionCallback,
  ThreadStartOptions,
} from "./types.js";
import { isDocument } from "./utils.js";

const DEFAULT_THREAD_NAME = "Thread";
const MAX_INFERRED_THREAD_NAME_LENGTH = 80;

interface ReactionCapable {
  addReactions(emojis: string[]): unknown;
  onReaction(callback: ReactionCallback): unknown;
}

function normalizeThreadName(name?: string): string | null {
  const trimmed = name?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

function toThreadNameSource(content?: MessageContent): string {
  if (content === undefined) {
    return "";
  }
  return isDocument(content) ? content.toPlainText() : content;
}

/** Apply declarative send options (reactions and reaction handler) to a message. */
export function applyMessageSendOptions<T extends ReactionCapable>(
  message: T,
  options?: MessageSendOptions
): T {
  const reactions = options?.reactions;
  if (reactions !== undefined && reactions.length > 0) {
    message.addReactions(reactions);
  }
  if (options?.onReaction) {
    message.onReaction(options.onReaction);
  }
  return message;
}

/** Normalize either a file list or options object into `MessageSendOptions`. */
export function resolveMessageSendOptions(
  optionsOrFiles?: MessageSendOptions | FileAttachment[]
): MessageSendOptions | undefined {
  if (optionsOrFiles === undefined) {
    return undefined;
  }
  return Array.isArray(optionsOrFiles)
    ? { files: optionsOrFiles }
    : optionsOrFiles;
}

/** Extract transport-level options used by platform adapters. */
export function toTransportMessageOptions(
  options?: ChannelMessageOptions
): { files?: FileAttachment[]; linkPreviews?: boolean } | undefined {
  if (options === undefined) {
    return undefined;
  }

  if (options.files === undefined && options.linkPreviews === undefined) {
    return undefined;
  }

  return {
    files: options.files,
    linkPreviews: options.linkPreviews,
  };
}

/** Infer a reasonable default thread name from message content. */
export function inferThreadName(content?: MessageContent): string {
  const source = toThreadNameSource(content);
  const firstMeaningfulLine =
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const collapsed = firstMeaningfulLine.replace(/\s+/g, " ").trim();

  if (collapsed === "") {
    return DEFAULT_THREAD_NAME;
  }

  if (collapsed.length <= MAX_INFERRED_THREAD_NAME_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_INFERRED_THREAD_NAME_LENGTH - 3).trimEnd()}...`;
}

/** Resolve thread creation options from either a name string or options object. */
export function resolveThreadStartOptions(
  content: MessageContent | undefined,
  nameOrOptions?: string | ThreadStartOptions,
  autoArchiveDuration?: number
): { name: string; autoArchiveDuration?: number } {
  if (typeof nameOrOptions === "string") {
    return {
      name: normalizeThreadName(nameOrOptions) ?? inferThreadName(content),
      autoArchiveDuration,
    };
  }

  return {
    name: normalizeThreadName(nameOrOptions?.name) ?? inferThreadName(content),
    autoArchiveDuration: nameOrOptions?.autoArchiveDuration,
  };
}
