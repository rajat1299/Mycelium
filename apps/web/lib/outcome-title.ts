export function deriveOutcomeTitle(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "Untitled task";
  }

  const firstSentence = normalized.split(/[.!?]/)[0]?.trim() ?? normalized;

  if (firstSentence.length <= 52) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, 49).trimEnd()}...`;
}
