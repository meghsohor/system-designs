import { describe, expect, it } from 'vitest'
import type { CatalogPage } from '../.vitepress/lib/catalog.ts'
import { designListRange, type ListToken } from '../.vitepress/lib/design-cards.ts'
import { sentence } from '../.vitepress/lib/sentence.ts'
import { designOrder, readAction, readLabel } from '../.vitepress/theme/designs.ts'

describe('designListRange', () => {
  const list = (href: string): ListToken[] => [
    { type: 'bullet_list_open', level: 0 },
    { type: 'list_item_open', level: 1 },
    {
      type: 'inline',
      level: 3,
      children: [{ type: 'link_open', level: 0, attrs: [['href', href]] }],
    },
    { type: 'list_item_close', level: 1 },
    { type: 'bullet_list_close', level: 0 },
  ]
  const isDesign = (href: string) => href.endsWith('/design.md')

  it('finds the list of design links and skips other lists', () => {
    const tokens = [...list('../learn/x.md'), ...list('a/design.md')]
    expect(designListRange(tokens, isDesign)).toEqual([5, 9])
  })

  it('finds nothing without a design list', () => {
    expect(designListRange(list('../learn/x.md'), isDesign)).toBeUndefined()
  })
})

const page = (label: string, kind: CatalogPage['kind']): CatalogPage => ({
  path: `designs/${label}/design.md`,
  link: `/designs/${label}/design`,
  label,
  title: label,
  kind,
  section: 'designs',
})

describe('designOrder', () => {
  it('puts written designs first and keeps index order within each group', () => {
    const pages = [page('a', 'soon'), page('b', 'written'), page('c', 'soon'), page('d', 'written')]
    expect(designOrder(pages).map((p) => p.label)).toEqual(['b', 'd', 'a', 'c'])
  })
})

describe('readLabel and readAction', () => {
  const at = '2026-11-24T00:00:00Z'

  it('follow the saved progress', () => {
    expect([readLabel(undefined), readAction(undefined)]).toEqual(['Not started', 'Start reading'])
    const reading = { status: 'in-progress' as const, position: 0.4, updatedAt: at }
    expect([readLabel(reading), readAction(reading)]).toEqual(['40% read', 'Continue'])
    const done = { status: 'done' as const, position: 1, updatedAt: at }
    expect([readLabel(done), readAction(done)]).toEqual(['Done', 'Read again'])
  })
})

describe('sentence', () => {
  it('capitalises an index summary', () => {
    expect(sentence('key-value lookups.')).toBe('Key-value lookups.')
  })
})
