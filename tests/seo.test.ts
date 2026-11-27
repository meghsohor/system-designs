import { describe, expect, it } from 'vitest'
import type { CatalogSection } from '../.vitepress/lib/catalog.ts'
import { describePage, isIndexable, seoHead, type Site } from '../.vitepress/lib/seo.ts'

const site: Site = {
  url: 'https://example.com/book',
  name: 'Book',
  description: 'A book.',
  image: { path: 'og.png', width: 1200, height: 630, alt: 'Book cover' },
}

const catalog: CatalogSection[] = [
  {
    id: 'designs',
    title: 'Designs',
    nav: 'Designs',
    summary: 'complete designs.',
    overviewLink: '/designs/',
    overviewPath: 'designs/index.md',
    pages: [
      {
        path: 'designs/a/design.md',
        link: '/designs/a/design',
        label: 'Short links',
        title: 'Designing short links',
        summary: 'lookups and caching.',
        kind: 'written',
        section: 'designs',
        quiz: 'designs/a/quiz.md',
        quizLink: '/designs/a/quiz',
        quizQuestions: 20,
      },
      {
        path: 'designs/b/design.md',
        link: '/designs/b/design',
        label: 'Chat',
        title: 'Chat',
        kind: 'soon',
        section: 'designs',
      },
    ],
  },
]

const tags = (head: ReturnType<typeof seoHead>): Record<string, string | undefined> =>
  Object.fromEntries(
    head.map(([tag, attrs, content]) => [
      attrs.property ?? attrs.name ?? attrs.rel ?? attrs.type ?? tag,
      attrs.content ?? attrs.href ?? content,
    ]),
  )

describe('describePage', () => {
  it('uses the index summary as a sentence', () => {
    expect(describePage('designs/a/design.md', '# A\n\nIntro.', catalog)).toBe(
      'Lookups and caching.',
    )
    expect(describePage('designs/index.md', '# Designs', catalog)).toBe('Complete designs.')
  })
  it('falls back to the first sentence', () => {
    expect(describePage('learn/x.md', '# X\n\nFirst one. Second one.', catalog)).toBe('First one.')
  })
  it('describes a quiz by its design', () => {
    expect(describePage('designs/a/quiz.md', '', catalog)).toBe(
      '20 questions on the Short links design, with explanations.',
    )
  })
})

describe('isIndexable', () => {
  it('lists written, overview and home pages only', () => {
    expect(isIndexable('designs/a/design.md', 'written')).toBe(true)
    expect(isIndexable('designs/index.md', 'overview')).toBe(true)
    expect(isIndexable('index.md', 'app')).toBe(true)
    expect(isIndexable('progress.md', 'app')).toBe(false)
    expect(isIndexable('designs/b/design.md', 'soon')).toBe(false)
    expect(isIndexable('designs/a/quiz.md', 'quiz')).toBe(false)
  })
})

describe('seoHead', () => {
  const written = {
    path: 'designs/a/design.md',
    kind: 'written' as const,
    title: 'Designing short links',
    description: 'Lookups and caching.',
    lastUpdated: Date.UTC(2026, 10, 20),
  }

  it('gives a written page a canonical URL, Open Graph tags and a TechArticle', () => {
    const t = tags(seoHead(written, site))
    expect(t.canonical).toBe('https://example.com/book/designs/a/design')
    expect(t.robots).toBeUndefined()
    expect(t['og:type']).toBe('article')
    expect(t['og:title']).toBe('Designing short links')
    expect(t['og:image']).toBe('https://example.com/book/og.png')
    expect(t['twitter:card']).toBe('summary_large_image')
    expect(JSON.parse(t['application/ld+json'] ?? '')).toMatchObject({
      '@type': 'TechArticle',
      headline: 'Designing short links',
      dateModified: '2026-11-20T00:00:00.000Z',
    })
  })

  it('marks coming-soon and quiz pages noindex, without a canonical URL or JSON-LD', () => {
    for (const kind of ['soon', 'quiz'] as const) {
      const t = tags(seoHead({ ...written, kind }, site))
      expect(t.robots).toBe('noindex')
      expect(t.canonical).toBeUndefined()
      expect(t['application/ld+json']).toBeUndefined()
    }
  })

  it('gives the home page a WebSite and the site name', () => {
    const t = tags(seoHead({ ...written, path: 'index.md', kind: 'app', title: '' }, site))
    expect(t.canonical).toBe('https://example.com/book/')
    expect(t['og:title']).toBe('Book')
    expect(JSON.parse(t['application/ld+json'] ?? '')['@type']).toBe('WebSite')
  })

  it('keeps JSON-LD from closing its script tag', () => {
    const t = tags(seoHead({ ...written, title: '</script><b>' }, site))
    expect(t['application/ld+json']).not.toContain('</script>')
  })

  it('gives the 404 page only a description and noindex', () => {
    const head = seoHead({ ...written, path: '404.md', kind: 'app' }, site)
    expect(head).toHaveLength(2)
    expect(tags(head).robots).toBe('noindex')
  })
})
