/** Index summaries follow a colon, so they start in lower case; this capitalises them. */
export function sentence(text?: string): string | undefined {
  return text && text[0]?.toUpperCase() + text.slice(1)
}
