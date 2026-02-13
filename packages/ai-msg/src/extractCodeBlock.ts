const codeBlockRegex = /^```(\w*)\s*\n([\s\S]*?)^```/gm;

export function extractCodeBlock(text: string, lang?: string): string[] {
  const results: string[] = [];

  for (const match of text.matchAll(codeBlockRegex)) {
    const tag = match[1];
    const content = match[2];
    if (lang && tag.toLowerCase() !== lang.toLowerCase()) continue;
    results.push(content.trimEnd());
  }

  return results;
}
