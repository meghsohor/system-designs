// Head tags for search engines and link previews. Runs in Node at build time.
import type { HeadConfig } from 'vitepress'
import { firstSentence, linkOf, type CatalogSection, type PageKind } from './catalog.ts'
import { sentence } from './sentence.ts'

export interface Site {
  /** The site's address with its base path, without a trailing slash. */
  url: string
  name: string
  description: string
  image: { path: string; width: number; height: number; alt: string }
}

export interface SeoPage {
  path: string
  kind: PageKind
  title: string
  description: string
  /** Last commit time in ms, when known. */
  lastUpdated?: number
}

/** Pages that search engines may list: written pages, section overviews and the home page. */
export function isIndexable(path: string, kind: PageKind): boolean {
  return kind === 'written' || kind === 'overview' || path === 'index.md'
}

/** The meta description: the section index's summary, otherwise the page's first sentence. */
export function describePage(
  path: string,
  src: string,
  catalog: CatalogSection[],
): string | undefined {
  for (const section of catalog) {
    if (section.overviewPath === path && !section.pages.some((p) => p.path === path))
      return sentence(section.summary)
    for (const page of section.pages) {
      if (page.path === path && page.summary) return sentence(page.summary)
      if (page.quiz === path)
        return `${page.quizQuestions} ${page.quizQuestions === 1 ? 'question' : 'questions'} on the ${page.label} design, with explanations.`
    }
  }
  return firstSentence(src)
}

export const pageUrl = (site: Site, path: string): string => site.url + linkOf(path)

// Inline JSON-LD must not close its own script tag.
const jsonLd = (data: object): HeadConfig => [
  'script',
  { type: 'application/ld+json' },
  JSON.stringify(data).replaceAll('<', '\\u003c'),
]

export function seoHead(page: SeoPage, site: Site): HeadConfig[] {
  const home = page.path === 'index.md'
  const url = pageUrl(site, page.path)
  const image = site.url + '/' + site.image.path
  const title = home || !page.title ? site.name : page.title
  // VitePress writes its own description tag unescaped; this one replaces it.
  const head: HeadConfig[] = [['meta', { name: 'description', content: page.description }]]
  if (page.path === '404.md') return [...head, ['meta', { name: 'robots', content: 'noindex' }]]

  if (isIndexable(page.path, page.kind)) head.push(['link', { rel: 'canonical', href: url }])
  else head.push(['meta', { name: 'robots', content: 'noindex' }])

  const og: [string, string][] = [
    ['og:type', page.kind === 'written' ? 'article' : 'website'],
    ['og:site_name', site.name],
    ['og:title', title],
    ['og:description', page.description],
    ['og:url', url],
    ['og:image', image],
    ['og:image:width', String(site.image.width)],
    ['og:image:height', String(site.image.height)],
    ['og:image:alt', site.image.alt],
  ]
  for (const [property, content] of og) head.push(['meta', { property, content }])
  head.push(['meta', { name: 'twitter:card', content: 'summary_large_image' }])

  if (home) {
    head.push(
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        description: site.description,
        url,
        inLanguage: 'en',
      }),
    )
  } else if (page.kind === 'written') {
    head.push(
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: page.title,
        description: page.description,
        url,
        mainEntityOfPage: url,
        image,
        inLanguage: 'en',
        ...(page.lastUpdated && { dateModified: new Date(page.lastUpdated).toISOString() }),
        isPartOf: { '@type': 'WebSite', name: site.name, url: pageUrl(site, 'index.md') },
      }),
    )
  }
  return head
}
