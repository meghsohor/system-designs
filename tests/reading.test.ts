import { describe, expect, it } from 'vitest'
import {
  DWELL_MS,
  nextStatus,
  readFraction,
  readSections,
  scrollFor,
  shouldResume,
} from '../.vitepress/theme/progress/reading.ts'

describe('readFraction', () => {
  const page = { viewportHeight: 800, contentBottom: 2800 }

  it('runs from 0 at the top to 1 when the end of the content is in view', () => {
    expect(readFraction({ ...page, scrollY: 0 })).toEqual({ fraction: 0, fits: false })
    expect(readFraction({ ...page, scrollY: 1000 })).toEqual({ fraction: 0.5, fits: false })
    expect(readFraction({ ...page, scrollY: 2000 }).fraction).toBe(1)
    expect(readFraction({ ...page, scrollY: 2600 }).fraction).toBe(1)
  })

  it('treats a page that fits the screen as fully in view', () => {
    expect(readFraction({ scrollY: 0, viewportHeight: 900, contentBottom: 700 })).toEqual({
      fraction: 1,
      fits: true,
    })
  })

  it('round-trips with scrollFor', () => {
    const y = scrollFor(0.37, page)
    expect(readFraction({ ...page, scrollY: y }).fraction).toBeCloseTo(0.37)
    expect(scrollFor(0.5, { viewportHeight: 900, contentBottom: 700 })).toBe(0)
  })
})

describe('nextStatus', () => {
  const reading = { fraction: 0, fits: false, elapsed: 0, userScrolled: false }

  it('is in progress past 5%, or after 20 s', () => {
    expect(nextStatus(reading)).toBeUndefined()
    expect(nextStatus({ ...reading, fraction: 0.05 })).toBeUndefined()
    expect(nextStatus({ ...reading, fraction: 0.06 })).toBe('in-progress')
    expect(nextStatus({ ...reading, elapsed: DWELL_MS })).toBe('in-progress')
  })

  it('is done when the end comes into view only after the reader scrolled', () => {
    expect(nextStatus({ ...reading, fraction: 1 })).toBe('in-progress')
    expect(nextStatus({ ...reading, fraction: 1, userScrolled: true })).toBe('done')
  })

  it('makes a page that fits the screen done after 20 s, not on open', () => {
    const fits = { ...reading, fraction: 1, fits: true }
    expect(nextStatus(fits)).toBeUndefined()
    expect(nextStatus({ ...fits, userScrolled: true })).toBeUndefined()
    expect(nextStatus({ ...fits, elapsed: DWELL_MS })).toBe('done')
  })
})

describe('shouldResume', () => {
  it('resumes a saved place mid-page when there is no #hash', () => {
    expect(shouldResume(0.4, '')).toBe(true)
    expect(shouldResume(0.05, '')).toBe(true)
    expect(shouldResume(0.95, '')).toBe(true)
  })

  it('stays put near the top or end, without a saved place, or for a #hash link', () => {
    expect(shouldResume(0.02, '')).toBe(false)
    expect(shouldResume(0.99, '')).toBe(false)
    expect(shouldResume(undefined, '')).toBe(false)
    expect(shouldResume(0.4, '#deep-dives')).toBe(false)
  })
})

describe('readSections', () => {
  const headings = [
    { id: 'a', level: 2, top: -900 },
    { id: 'a1', level: 3, top: -600 },
    { id: 'a2', level: 3, top: -100 },
    { id: 'b', level: 2, top: 300 },
    { id: 'c', level: 2, top: 1200 },
  ]

  it('ticks a section once the next one at its level has reached the line', () => {
    // Reading a2: a1 is done, but a (the parent) isn't until b arrives.
    expect(readSections(headings, 80, false)).toEqual(['a1'])
    const atB = headings.map((h) => (h.id === 'b' ? { ...h, top: 60 } : h))
    expect(readSections(atB, 80, false)).toEqual(['a', 'a1', 'a2'])
  })

  it('ticks nothing at the top and everything at the end', () => {
    const top = headings.map((h, i) => ({ ...h, top: 200 + i * 400 }))
    expect(readSections(top, 80, false)).toEqual([])
    expect(readSections(top, 80, true)).toEqual(['a', 'a1', 'a2', 'b', 'c'])
  })

  it('never ticks the last section until the end is in view', () => {
    const last = headings.map((h, i) => ({ ...h, top: -2000 + i * 100 }))
    expect(readSections(last, 80, false)).toEqual(['a', 'a1', 'a2', 'b'])
  })
})
