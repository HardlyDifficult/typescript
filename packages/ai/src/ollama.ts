import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";

/** Creates an Ollama language model. Model names match whatever is installed locally. */
export function ollama(model: string): LanguageModel {
  return createOllama()(model);
}
