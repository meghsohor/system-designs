import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  isComingSoon,
  kindOf,
  linkOf,
  loadCatalog,
  neighbours,
  parseIndexLinks,
  titleOf,
  type SectionDef,
} from '../.vitepress/lib/catalog.ts'

describe('titleOf', () => {
  it('reads the first-line title', () => {
    expect(titleOf('# Caching\n\nText')).toBe('Caching')
  })
  it('skips front matter and blank lines', () => {
    expect(titleOf('---\nlayout: doc\n---\n\n# Home\n')).toBe('Home')
  })
  it('returns undefined when the first line is not a title', () => {
    expect(titleOf('Design Uber\n')).toBeUndefined()
    expect(titleOf('## Not level one\n')).toBeUndefined()
  })
  it('handles a byte-order mark, empty front matter and formatting', () => {
    expect(titleOf('﻿# Redis\n')).toBe('Redis')
    expect(titleOf('---\n---\n# Redis\n')).toBe('Redis')
    expect(titleOf('# **Redis** and `etcd`\n')).toBe('Redis and etcd')
  })
})

describe('isComingSoon', () => {
  it('is true for a title with nothing after it', () => {
    expect(isComingSoon('# Redis\n')).toBe(true)
    expect(isComingSoon('# Redis\n\n   \n')).toBe(true)
  })
  it('is false once there is any text', () => {
    expect(isComingSoon('# Redis\n\nIn-memory store.')).toBe(false)
  })
  it('ignores HTML comments', () => {
    expect(isComingSoon('# Redis\n\n<!-- TODO: write this -->\n')).toBe(true)
  })
})

describe('parseIndexLinks', () => {
  it('reads list items in order with their summaries', () => {
    const src = '# Concepts\n\n- [Caching](caching.md): cache-aside.\n- [Sharding](sharding.md)\n'
    expect(parseIndexLinks(src, 'learn/core-concepts')).toEqual([
      { target: 'learn/core-concepts/caching.md', text: 'Caching', summary: 'cache-aside.' },
      { target: 'learn/core-concepts/sharding.md', text: 'Sharding', summary: undefined },
    ])
  })

  it('reads links from a table and keeps the first appearance only', () => {
    const src = [
      '| 1 | [Understand](01-understand.md) | 1 min |',
      '| 2 | [Requirements](02-requirements.md#x) | 5 min |',
      'See [01-understand.md](01-understand.md) again.',
    ].join('\n')
    expect(parseIndexLinks(src, 'learn/framework').map((l) => l.target)).toEqual([
      'learn/framework/01-understand.md',
      'learn/framework/02-requirements.md',
    ])
  })

  it('ignores links outside the section, index, quiz, external and code blocks', () => {
    const src = [
      '[Framework](../learn/framework/index.md) [Self](index.md) [Quiz](a/quiz.md)',
      '[Web](https://example.com/x.md)',
      '```',
      '[Code](code.md)',
      '```',
      '- [Design](url-shortener/design.md): ok',
    ].join('\n')
    expect(parseIndexLinks(src, 'designs').map((l) => l.target)).toEqual([
      'designs/url-shortener/design.md',
    ])
  })

  it('skips commented-out links', () => {
    const src = '<!-- - [Old](old.md) -->\n\n- [New](new.md)\n'
    expect(parseIndexLinks(src, 'patterns').map((l) => l.target)).toEqual(['patterns/new.md'])
  })

  it('understands titled, angle-bracket, reference and root links', () => {
    const src = [
      '- [**A**](a.md "Title"): first',
      '- [B](<b page.md>)',
      '- [C][c]',
      '- [D](/patterns/d.md)',
      '',
      '[c]: c.md',
    ].join('\n')
    expect(parseIndexLinks(src, 'patterns')).toEqual([
      { target: 'patterns/a.md', text: 'A', summary: 'first' },
      { target: 'patterns/b page.md', text: 'B', summary: undefined },
      { target: 'patterns/c.md', text: 'C', summary: undefined },
      { target: 'patterns/d.md', text: 'D', summary: undefined },
    ])
  })
})

describe('linkOf', () => {
  it('turns content paths into clean URLs', () => {
    expect(linkOf('index.md')).toBe('/')
    expect(linkOf('learn/framework/index.md')).toBe('/learn/framework/')
    expect(linkOf('designs/url-shortener/design.md')).toBe('/designs/url-shortener/design')
    expect(linkOf('learn/core-concepts/database-indexing.md')).toBe(
      '/learn/core-concepts/database-indexing',
    )
  })
})

describe('loadCatalog', () => {
  let root = ''
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  const sections: SectionDef[] = [
    {
      id: 'framework',
      dir: 'learn/framework',
      title: 'Framework',
      nav: 'F',
      overviewIsPage: true,
      numbered: true,
    },
    { id: 'designs', dir: 'designs', title: 'Designs', nav: 'D' },
  ]
  const setup = () => {
    root = mkdtempSync(join(tmpdir(), 'catalog-'))
    write('learn/framework/index.md', '# Framework\n\n| [Understand](01-understand.md) |\n')
    write('learn/framework/01-understand.md', '# 1. Understand\n\nText.\n')
    write(
      'designs/index.md',
      '# Designs\n\n- [Shortener](short/design.md): links.\n- [Chat](chat/design.md)\n',
    )
    write('designs/short/design.md', '# Shortener\n\nText.\n')
    write('designs/short/quiz.md', '# Quiz\n')
    write('designs/chat/design.md', '# Chat\n')
  }

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('builds sections with kinds, numbering and quizzes', () => {
    setup()
    const catalog = loadCatalog(root, sections)
    expect(catalog[0]?.pages.map((p) => p.label)).toEqual(['Overview', '1. Understand'])
    expect(catalog[1]?.pages).toMatchObject([
      {
        path: 'designs/short/design.md',
        kind: 'written',
        quiz: 'designs/short/quiz.md',
        summary: 'links.',
      },
      { path: 'designs/chat/design.md', kind: 'soon', quiz: undefined },
    ])
    expect(kindOf('designs/index.md', catalog)).toBe('overview')
    expect(kindOf('learn/framework/index.md', catalog)).toBe('written')
    expect(kindOf('designs/short/quiz.md', catalog)).toBe('quiz')
    expect(kindOf('index.md', catalog)).toBe('app')
  })

  it('reports missing pages, unlisted pages and missing titles together', () => {
    setup()
    write('designs/index.md', '# Designs\n\n- [Gone](gone/design.md)\n- [Chat](chat/design.md)\n')
    write('designs/chat/design.md', 'Chat without a title\n')
    expect(() => loadCatalog(root, sections)).toThrowError(
      /links to a missing page: designs\/gone\/design\.md[\s\S]*chat\/design\.md: must start with[\s\S]*short\/design\.md: not linked/,
    )
  })

  it('skips coming-soon pages for previous and next', () => {
    setup()
    const catalog = loadCatalog(root, sections)
    expect(neighbours('learn/framework/01-understand.md', catalog)).toEqual({
      prev: { text: 'Overview', link: '/learn/framework/' },
      next: { text: 'Designs', link: '/designs/' },
    })
    expect(neighbours('designs/short/design.md', catalog).next).toBeUndefined()
    expect(neighbours('designs/chat/design.md', catalog).prev).toEqual({
      text: 'Shortener',
      link: '/designs/short/design',
    })
  })
})
