import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { Agent } from "undici";
import type { Dispatcher } from "undici-types";

// Extended timeouts for Ollama — large models (e.g. qwen3-coder-next) can take
// 10-15 minutes to load into memory on first use, exceeding Node's default 5-min
// headersTimeout and causing HeadersTimeoutError.
const ollamaAgent = new Agent({
  headersTimeout: 60 * 60 * 1000, // 60 min — allows for large model loading
  bodyTimeout: 30 * 60 * 1000, // 30 min — streaming chunks should arrive regularly once started
  connectTimeout: 60 * 1000, // 1 min  — localhost connection should be near-instant
});

/**
 * Inject `keep_alive: -1` into Ollama POST request bodies so the model stays
 * loaded in GPU memory indefinitely. The ollama-ai-provider-v2 package doesn't
 * expose this option for chat models, so we intercept at the fetch layer.
 */
function injectKeepAlive(init?: RequestInit): RequestInit | undefined {
  if (init?.body == null || init.method?.toUpperCase() !== "POST") return init;
  try {
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    body["keep_alive"] = -1;
    return { ...init, body: JSON.stringify(body) };
  } catch {
    return init;
  }
}

const provider = createOllama({
  fetch: ((input: string | URL | Request, init?: RequestInit) => {
    const patched = injectKeepAlive(init);
    // Node.js fetch accepts undici's dispatcher option for custom agents.
    // TypeScript has conflicting types between undici and @types/node's undici-types.
    // The Agent from undici is functionally compatible with Dispatcher but structurally
    // incompatible due to differences between the two type definitions.
    const fetchOptions: RequestInit & { dispatcher?: Dispatcher } = {
      ...patched,
      // @ts-expect-error - Type mismatch between undici Agent and undici-types Dispatcher (runtime compatible)
      dispatcher: ollamaAgent,
    };
    return fetch(input, fetchOptions);
  }) as typeof fetch,
});

/** Creates an Ollama language model. Model names match whatever is installed locally. */
export function ollama(model: string): LanguageModel {
  return provider(model);
}
