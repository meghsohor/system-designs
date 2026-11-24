/** The parts of a markdown-it token this needs. */
export interface ListToken {
  type: string
  level: number
  attrs?: [string, string][] | null
  children?: ListToken[] | null
}

/**
 * The top-level bullet list whose first link points at a design, as the indexes of its open
 * and close tokens; another list in the intro is never mistaken for it.
 */
export function designListRange(
  tokens: readonly ListToken[],
  isDesign: (href: string) => boolean,
): [number, number] | undefined {
  for (let start = 0; start < tokens.length; start++) {
    const open = tokens[start]
    if (open?.type !== 'bullet_list_open' || open.level !== 0) continue
    const end = tokens.findIndex(
      (t, i) => i > start && t.type === 'bullet_list_close' && t.level === 0,
    )
    if (end === -1) return undefined
    const link = tokens
      .slice(start, end)
      .flatMap((t) => t.children ?? [])
      .find((c) => c.type === 'link_open')
    const href = link?.attrs?.find(([name]) => name === 'href')?.[1]
    if (href && isDesign(href)) return [start, end]
    start = end
  }
  return undefined
}
