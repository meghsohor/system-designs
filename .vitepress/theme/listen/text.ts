// Turning a block's text into what the player says, one sentence at a time.

/** A block's text, with where each character came from, so a sentence can be highlighted. */
export interface FlatText {
  text: string
  /** For each character of `text`: which piece it came from, and where in that piece. */
  piece: number[]
  offset: number[]
}

/** Joins text pieces, collapsing whitespace to single spaces and trimming the ends. */
export function flatten(pieces: readonly string[]): FlatText {
  let text = ''
  const piece: number[] = []
  const offset: number[] = []
  let afterSpace = true
  pieces.forEach((part, p) => {
    for (let i = 0; i < part.length; i++) {
      const ch = part[i] ?? ''
      // Zero-width spaces fill VitePress's heading anchors.
      if (ch === '​') continue
      if (/\s/.test(ch)) {
        if (afterSpace) continue
        afterSpace = true
        text += ' '
      } else {
        afterSpace = false
        text += ch
      }
      piece.push(p)
      offset.push(i)
    }
  })
  if (text.endsWith(' ')) {
    text = text.slice(0, -1)
    piece.pop()
    offset.pop()
  }
  return { text, piece, offset }
}

// Words that end in a full stop without ending the sentence.
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'approx', 'cf', 'mr', 'mrs', 'ms', 'dr'])
const SENTENCE_END = /[.!?…]+["'”’)\]]*(?=\s)/g

/**
 * Splits text into sentences, as [start, end) ranges. A sentence longer than `max` characters
 * is split at a comma, colon or space, since some browsers stop long utterances part way.
 */
export function sentences(text: string, max = 160): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let start = 0
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length
    const before = text.slice(start, match.index).trim()
    const word = before.split(' ').pop()?.toLowerCase() ?? ''
    if (match[0].startsWith('.')) {
      if (ABBREVIATIONS.has(word)) continue
      // "1. Understand the problem": a heading's number.
      if (/^\d+$/.test(before)) continue
    }
    const next = text.slice(end).trimStart()[0]
    if (next && /\p{Ll}/u.test(next)) continue
    out.push(...fit(text, start, end, max))
    start = end
  }
  out.push(...fit(text, start, text.length, max))
  return out
}

/** Trims a range and splits it into pieces of at most `max` characters. */
function fit(text: string, start: number, end: number, max: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let s = start
  let e = end
  const trim = () => {
    while (s < e && text[s] === ' ') s++
    while (e > s && text[e - 1] === ' ') e--
  }
  trim()
  while (e - s > max) {
    const cut = breakPoint(text.slice(s, s + max + 1), max)
    out.push([s, s + cut])
    s += cut
    trim()
  }
  if (e > s) out.push([s, e])
  return out
}

/** Where to end a piece of `window`: after the last clause break, else the last space. */
function breakPoint(window: string, max: number): number {
  const min = Math.floor(max / 3)
  for (const pattern of [/[,;:—–](?= )/g, / /g]) {
    let last = -1
    for (const match of window.matchAll(pattern)) {
      const at = match.index + (match[0] === ' ' ? 0 : 1)
      if (at >= min && at <= max) last = at
    }
    if (last !== -1) return last
  }
  return max
}
