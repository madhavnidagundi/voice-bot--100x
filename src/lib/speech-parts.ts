// Keep sentence boundaries for natural pauses; cap request count for long answers.
export function speechParts(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) continue;
    if (parts.length && (parts.at(-1)!.length < 100 || parts.length >= 6))
      parts[parts.length - 1] += ` ${clean}`;
    else parts.push(clean);
  }
  return parts.length ? parts : [text];
}
