import { describe, expect, it } from 'vitest'
import type { CatalogSection } from '../.vitepress/lib/catalog.ts'
import {
  absoluteLinks,
  builtFileUrl,
  llmsToc,
  mdCopyPath,
  type LinkContext,
} from '../.vitepress/lib/llms.ts'

const SITE = 'https://example.com/book'

describe('mdCopyPath', () => {
  it('matches where the plugin writes each copy', () => {
    expect(mdCopyPath('/learn/framework/')).toBe('learn/framework.md')
    expect(mdCopyPath('/designs/a/design')).toBe('designs/a/design.md')
    expect(mdCopyPath('/')).toBe('index.md')
  })
})

describe('llmsToc', () => {
  const page = (path: string, kind: 'written' | 'soon', extra = {}) => ({
    path,
    link: '/' + path.replace(/\.md$/, ''),
    label: path,
    title: `Title of ${path}`,
    kind,
    section: 's',
    ...extra,
  })
  const catalog: CatalogSection[] = [
    {
      id: 'a',
      title: 'Framework',
      nav: 'A',
      overviewLink: '/a/',
      overviewPath: 'a/index.md',
      pages: [{ ...page('a/index.md', 'written'), link: '/a/' }, page('a/one.md', 'written')],
    },
    {
      id: 'b',
      title: 'Empty',
      nav: 'B',
      overviewLink: '/b/',
      overviewPath: 'b/index.md',
      pages: [page('b/x.md', 'soon')],
    },
    {
      id: 'c',
      title: 'Designs',
      nav: 'C',
      overviewLink: '/c/',
      overviewPath: 'c/index.md',
      pages: [page('c/d.md', 'written', { summary: 'caching.' })],
    },
  ]

  it('lists written pages by section and leaves empty sections out', () => {
    expect(llmsToc(catalog, SITE)).toBe(
      [
        '### Framework',
        '',
        `- [Title of a/index.md](${SITE}/a.md)`,
        `- [a/one.md](${SITE}/a/one.md)`,
        '',
        '### Designs',
        '',
        `- [c/d.md](${SITE}/c/d.md): caching.`,
      ].join('\n'),
    )
  })
})

describe('absoluteLinks', () => {
  const ctx: LinkContext = {
    siteUrl: SITE,
    written: new Set(['learn/framework/index.md', 'learn/framework/01-understand.md']),
    fileUrl: (path) => `${SITE}/files/${path}`,
  }

  it('points written pages at their .md copy and other pages at the web page', () => {
    const md = [
      '[step](01-understand.md#scope)',
      '[overview](index.md)',
      '[soon](../foundations/caching.md)',
    ].join('\n')
    expect(absoluteLinks(md, 'learn/framework/index.md', ctx)).toBe(
      [
        `[step](${SITE}/learn/framework/01-understand.md#scope)`,
        `[overview](${SITE}/learn/framework.md)`,
        `[soon](${SITE}/learn/foundations/caching)`,
      ].join('\n'),
    )
  })

  it('resolves images through fileUrl and keeps their title', () => {
    expect(absoluteLinks('![A](./a.svg "Cap")', 'designs/x/design.md', ctx)).toBe(
      `![A](${SITE}/files/designs/x/a.svg "Cap")`,
    )
  })

  it('leaves full URLs, in-page anchors and code blocks alone', () => {
    const md = [
      '[gh](https://github.com/x)',
      '[here](#top)',
      '```md',
      '[step](01-understand.md)',
      '```',
    ].join('\n')
    expect(absoluteLinks(md, 'learn/framework/index.md', ctx)).toBe(md)
  })
})

describe('builtFileUrl', () => {
  const html = '<p><img src="/book/assets/redirect.BJljsFS7.svg" alt="x"></p>'

  it('finds the renamed image in the built page', () => {
    expect(builtFileUrl(html, 'designs/x/redirect.svg', SITE, 'https://gh/blob')).toBe(
      'https://example.com/book/assets/redirect.BJljsFS7.svg',
    )
  })

  it('falls back to the file on GitHub, raw for images', () => {
    expect(builtFileUrl(html, 'designs/x/other.svg', SITE, 'https://gh/blob')).toBe(
      'https://gh/blob/designs/x/other.svg?raw=true',
    )
    expect(builtFileUrl(html, 'designs/x/a.excalidraw', SITE, 'https://gh/blob')).toBe(
      'https://gh/blob/designs/x/a.excalidraw',
    )
  })
})
