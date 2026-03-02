/**
 * Heuristic to detect whether an AI response is asking the user a question
 * vs. reporting completion. Used to determine whether to notify the user
 * that input is needed.
 */

/**
 * Check if the AI's response ends with a question or request for user input.
 * Looks at the last meaningful paragraph for question marks and common
 * input-requesting phrases.
 */
export function isWaitingForInput(response: string): boolean {
  const trimmed = response.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Extract the last ~500 characters (roughly the last paragraph or two)
  const tail = trimmed.slice(-500);

  // Check if the tail ends with a question mark (most reliable signal)
  if (tail.trimEnd().endsWith("?")) {
    return true;
  }

  // Check for common question/input-requesting phrases in the tail (case-insensitive)
  const lowerTail = tail.toLowerCase();
  const inputPhrases = [
    "should i",
    "would you like",
    "do you want",
    "which option",
    "which approach",
    "let me know",
    "please clarify",
    "please confirm",
    "what would you prefer",
    "what do you think",
    "could you provide",
    "could you clarify",
    "can you provide",
    "need your input",
    "waiting for your",
    "before i proceed",
    "before proceeding",
    "your preference",
    "how would you like",
    "please let me know",
  ];

  return inputPhrases.some((phrase) => lowerTail.includes(phrase));
}
