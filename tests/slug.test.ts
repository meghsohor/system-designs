import { describe, expect, it } from 'vitest'
import { headingIds, slugify } from '../.vitepress/lib/slug.ts'

describe('slugify', () => {
  it('keeps a leading number, like GitHub', () => {
    expect(slugify('1. Understand the problem')).toBe('1-understand-the-problem')
  })

  it('drops punctuation and keeps hyphens', () => {
    expect(slugify('Deep dive 2: fast redirects and viral links')).toBe(
      'deep-dive-2-fast-redirects-and-viral-links',
    )
    expect(slugify('Read/write path')).toBe('readwrite-path')
    expect(slugify('High-level design')).toBe('high-level-design')
  })

  it('decodes HTML entities first, like GitHub', () => {
    expect(slugify('A &lt; B &amp; C')).toBe('a--b--c')
  })
})

describe('headingIds', () => {
  it('numbers repeated headings the way GitHub does', () => {
    expect(headingIds(['Example', 'Example', 'Example'])).toEqual([
      'example',
      'example-1',
      'example-2',
    ])
  })
})
