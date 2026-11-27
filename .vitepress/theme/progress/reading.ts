// The rules for when a page counts as in progress or done, kept free of the DOM so they can
// be tested. The tracker component feeds them measurements.

/** Past 5% of the way down, a page is in progress. */
export const STARTED_AT = 0.05
/** After 20 s on a page it's in progress, or done if it all fits on screen. */
export const DWELL_MS = 20_000
/** Resuming only makes sense between 5% and 95%. */
export const RESUME_RANGE = [0.05, 0.95] as const

export interface Geometry {
  /** How far the window has scrolled. */
  scrollY: number
  viewportHeight: number
  /** Where the note's content ends, from the top of the document. */
  contentBottom: number
}

/** How far through the content the reader is: 0 at the top, 1 when its end is in view. */
export function readFraction({ scrollY, viewportHeight, contentBottom }: Geometry): {
  fraction: number
  fits: boolean
} {
  const maxScroll = contentBottom - viewportHeight
  if (maxScroll <= 0) return { fraction: 1, fits: true }
  return { fraction: Math.min(Math.max(scrollY / maxScroll, 0), 1), fits: false }
}

/** The scroll position that puts the reader back at `fraction`. */
export function scrollFor(
  fraction: number,
  { viewportHeight, contentBottom }: Omit<Geometry, 'scrollY'>,
): number {
  return Math.max(contentBottom - viewportHeight, 0) * fraction
}

export interface Reading {
  fraction: number
  fits: boolean
  /** Time on the page, in milliseconds. */
  elapsed: number
  /** True once the reader has scrolled themselves (not our resume jump). */
  userScrolled: boolean
}

/**
 * What the page's status should become, if anything. "done" when the end of the content comes
 * into view after the reader scrolled, or after 20 s on a page that fits the screen.
 */
export function nextStatus({
  fraction,
  fits,
  elapsed,
  userScrolled,
}: Reading): 'in-progress' | 'done' | undefined {
  if (fits) return elapsed >= DWELL_MS ? 'done' : undefined
  if (userScrolled && fraction >= 0.995) return 'done'
  if (fraction > STARTED_AT || elapsed >= DWELL_MS) return 'in-progress'
  return undefined
}

/**
 * Whether Back or Forward will put the reader back on the page by itself. VitePress keeps a
 * place only for a page left by a link; a page left by Back or Forward opens at the top.
 */
export function historyRestoresPlace(state: unknown): boolean {
  const position = (state as { scrollPosition?: unknown } | null)?.scrollPosition
  return typeof position === 'number' && position > 0
}

/** Whether to take the reader back to a saved place: no #hash link, and a place mid-page. */
export function shouldResume(position: number | undefined, hash: string): boolean {
  if (hash || position === undefined) return false
  return position >= RESUME_RANGE[0] && position <= RESUME_RANGE[1]
}

export interface HeadingPosition {
  id: string
  /** 2 for h2, 3 for h3. */
  level: number
  /** Distance from the top of the window. */
  top: number
}

/**
 * The sections the reader has finished: a section is read once the next heading at its level
 * or above has scrolled up to `line` (just under the sticky header), or the end is in view.
 */
export function readSections(headings: HeadingPosition[], line: number, atEnd: boolean): string[] {
  if (atEnd) return headings.map((h) => h.id)
  let reached = -1
  headings.forEach((h, i) => {
    if (h.top <= line) reached = i
  })
  return headings
    .filter((h, i) => {
      const next = headings.findIndex((other, j) => j > i && other.level <= h.level)
      return next !== -1 && next <= reached
    })
    .map((h) => h.id)
}

/**
 * The section the reader is in, after the sections that contain it (an h2, then its h3): the
 * clicked one while `pinned`, otherwise the last heading that has reached `line`. None at the
 * very top, or at the end when nothing is pinned.
 */
export function currentPath(
  headings: HeadingPosition[],
  line: number,
  atEnd: boolean,
  pinned?: string,
): string[] {
  let index = -1
  if (pinned !== undefined) index = headings.findIndex((h) => h.id === pinned)
  else if (!atEnd) headings.forEach((h, i) => h.top <= line && (index = i))
  const current = headings[index]
  if (!current) return []
  const path = [current.id]
  let level = current.level
  for (let i = index - 1; i >= 0; i--) {
    const h = headings[i]
    if (h && h.level < level) {
      path.unshift(h.id)
      level = h.level
    }
  }
  return path
}
