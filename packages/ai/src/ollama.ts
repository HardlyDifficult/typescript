import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { Agent } from "undici";

// Extended timeouts for Ollama — large models (e.g. qwen3-coder-next) can take
// 10-15 minutes to load into memory on first use, exceeding Node's default 5-min
// headersTimeout and causing HeadersTimeoutError.
const ollamaAgent = new Agent({
  headersTimeout: 30 * 60 * 1000, // 30 min — allows for large model loading
  bodyTimeout: 10 * 60 * 1000, // 10 min — streaming chunks should arrive regularly once started
  connectTimeout: 60 * 1000, // 1 min  — localhost connection should be near-instant
});

const provider = createOllama({
  fetch: ((input: string | URL | Request, init?: RequestInit) =>
    fetch(input, {
      ...init,
      dispatcher: ollamaAgent,
    } as unknown as RequestInit)) as typeof fetch,
});

/** Creates an Ollama language model. Model names match whatever is installed locally. */
export function ollama(model: string): LanguageModel {
  return provider(model);
}
