import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const escapeAttr = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const ZOOM_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>'

/**
 * A picture with a zoom button and an optional caption under it. Diagrams are block-level
 * `<figure>`s; markdown images sit inside a `<p>`, so they use `<span>`s.
 */
export function figureHtml({
  img,
  alt,
  caption,
  block,
}: {
  img: string
  alt: string
  caption?: string
  block: boolean
}): string {
  const label = escapeAttr(`Enlarge: ${caption || alt || 'image'}`)
  const button = `<button type="button" class="zoom-button" aria-label="${label}" title="Enlarge">${ZOOM_ICON}</button>`
  const text = caption ? escapeAttr(caption) : ''
  if (block) {
    // v-pre: the page is a Vue template, and a caption with {{ }} must stay plain text.
    const figcaption = text ? `<figcaption class="figure-caption" v-pre>${text}</figcaption>` : ''
    return `<figure class="figure diagram">${img}${button}${figcaption}</figure>\n`
  }
  const span = text ? `<span class="figure-caption" v-pre>${text}</span>` : ''
  return `<span class="figure">${img}${button}${span}</span>`
}

/**
 * The width an SVG is drawn for: its viewBox width. Exports at 2× (Excalidraw) set `width` to
 * double that, which would make the zoom popup's readable-size floor twice too big.
 */
export function svgBaseWidth(svg: string): number | undefined {
  const tag = /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
  const width = Number(/\sviewBox="[^"]*?[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)/.exec(tag)?.[1])
  return width > 0 ? Math.ceil(width) : undefined
}

/** `svgBaseWidth` of a local SVG an image links to, resolved like VitePress does. */
export function localSvgBaseWidth(
  src: string,
  { contentDir, page }: { contentDir: string; page: string },
): number | undefined {
  if (!/\.svg$/i.test(src) || /^[a-z]+:|^\/\//i.test(src)) return undefined
  let path: string
  try {
    path = decodeURIComponent(src)
  } catch {
    return undefined
  }
  const file = path.startsWith('/')
    ? join(contentDir, 'public', path)
    : join(contentDir, dirname(page), path)
  return existsSync(file) ? svgBaseWidth(readFileSync(file, 'utf8')) : undefined
}

interface BlockToken {
  type: string
  hidden: boolean
  meta: unknown
  children: BlockToken[] | null
}

/**
 * Marks an image alone in a real paragraph (not a table cell, heading, tight list item or
 * link) with `meta.figure`, so the image rule renders it as a figure. Run after the inline rules.
 */
export function markFigures(tokens: BlockToken[]): void {
  tokens.forEach((token, i) => {
    const before = tokens[i - 1]
    const only = token.children?.length === 1 ? token.children[0] : undefined
    if (token.type !== 'inline' || before?.type !== 'paragraph_open' || before.hidden) return
    if (only?.type === 'image') only.meta = { ...(only.meta as object | null), figure: true }
  })
}
