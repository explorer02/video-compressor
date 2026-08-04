export function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

export function decapitalize(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
