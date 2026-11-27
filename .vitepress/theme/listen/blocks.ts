// Walks a page's content into the blocks the player reads: headings, paragraphs, list items and
// quotes, in order. Code, images and diagrams are skipped; a table becomes "Table skipped".
import { flatten, sentences } from './text.ts'

export interface Block {
  el: HTMLElement
  /** What's read aloud. */
  text: string
  /** One utterance each: sentences, or clauses of a long one. */
  parts: Array<[number, number]>
  /** The heading this block sits under. */
  section: string
  table: boolean
  /** Whether the box covers the whole element; for headings and items with a nested list it
   * covers just their words. */
  tint: boolean
  /** The text nodes `text` came from, and where each character sits in them. */
  nodes: Text[]
  piece: number[]
  offset: number[]
}

export const TABLE_SKIPPED = 'Table skipped.'

const SKIP = [
  'pre',
  'img',
  'svg',
  'figure',
  '.figure',
  '[class*="language-"]',
  '.header-anchor',
  '.page-actions',
  'button',
  'script',
  'style',
  'audio',
  'video',
  'iframe',
  '[aria-hidden="true"]',
].join(', ')
const LEAF = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SUMMARY', 'DT', 'DD'])
const MIXED = new Set(['LI', 'BLOCKQUOTE'])
// Elements inside a list item or quote that are read as blocks of their own.
const NESTED_BLOCK =
  'p, ul, ol, dl, pre, table, blockquote, div, figure, details, h1, h2, h3, h4, h5, h6'

/** The text nodes under `el`, leaving out skipped elements and, if asked, nested blocks. */
function textNodes(el: HTMLElement, ownOnly: boolean): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let p = node.parentElement; p && p !== el; p = p.parentElement) {
        if (p.matches(SKIP) || (ownOnly && p.matches(NESTED_BLOCK))) return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  return nodes
}

export function collectBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = []
  let section = ''

  const add = (el: HTMLElement, nodes: Text[], ownOnly: boolean) => {
    const flat = flatten(nodes.map((n) => n.data))
    if (!flat.text) return
    const heading = /^H\d$/.test(el.tagName)
    if (/^H[1-3]$/.test(el.tagName)) section = flat.text
    const nested = ownOnly && el.querySelector(NESTED_BLOCK) !== null
    const parts = sentences(flat.text)
    blocks.push({ el, ...flat, parts, section, table: false, tint: !heading && !nested, nodes })
  }

  const visit = (parent: Element) => {
    for (const child of parent.children) {
      if (!(child instanceof HTMLElement) || child.matches(SKIP)) continue
      if (child.tagName === 'TABLE') {
        const text = TABLE_SKIPPED
        blocks.push({
          el: child,
          text,
          parts: [[0, text.length]],
          section,
          table: true,
          tint: true,
          nodes: [],
          piece: [],
          offset: [],
        })
      } else if (LEAF.has(child.tagName)) {
        add(child, textNodes(child, false), false)
      } else if (MIXED.has(child.tagName)) {
        // A list item's own words, then its nested list (read once, as items of its own).
        add(child, textNodes(child, true), true)
        visit(child)
      } else {
        visit(child)
      }
    }
  }

  visit(root)
  return blocks
}

/** The DOM range of characters [start, end) of a block's text. */
export function rangeOf(block: Block, start: number, end: number): Range | undefined {
  const first = block.nodes[block.piece[start] ?? -1]
  const last = block.nodes[block.piece[end - 1] ?? -1]
  const from = block.offset[start]
  const to = block.offset[end - 1]
  if (!first || !last || from === undefined || to === undefined) return undefined
  const range = document.createRange()
  range.setStart(first, from)
  range.setEnd(last, to + 1)
  return range
}
