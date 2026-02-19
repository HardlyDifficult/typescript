import type { Message } from "./types.js";

/**
 * Function that sends messages to an AI model and returns the response text.
 * The caller provides this to decouple AgentConversation from any specific
 * AI infrastructure (worker manager, SDK, etc.).
 */
export type SendFn = (messages: Message[]) => Promise<string>;

/**
 * Maintains a multi-turn conversation with an AI model.
 *
 * Each call to {@link send} appends a user message, invokes the send function
 * with the full history, and appends the assistant response. The accumulated
 * history is available via {@link getHistory} for storage or display.
 *
 * @example
 * ```typescript
 * const conversation = new AgentConversation(sendFn, { systemPrompt: 'You are a coding assistant.' });
 * const result = await conversation.send('Generate a README for this repo.');
 * const merged = await conversation.send('Here is the original. Merge them: ...');
 * const history = conversation.getHistory(); // all messages including system prompt
 * ```
 */
export class AgentConversation {
  private readonly history: Message[] = [];
  private readonly sendFn: SendFn;

  constructor(sendFn: SendFn, options?: { systemPrompt?: string }) {
    this.sendFn = sendFn;

    if (options?.systemPrompt !== undefined && options.systemPrompt !== "") {
      this.history.push({ role: "system", content: options.systemPrompt });
    }
  }

  /**
   * Send a user message and get the assistant's response.
   * Appends both the user message and assistant response to the history.
   */
  async send(prompt: string): Promise<string> {
    this.history.push({ role: "user", content: prompt });

    const response = await this.sendFn([...this.history]);
    this.history.push({ role: "assistant", content: response });

    return response;
  }

  /** Get the full conversation history (system prompt + all turns). */
  getHistory(): Message[] {
    return [...this.history];
  }
}
