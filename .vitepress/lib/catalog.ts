// Builds the book's table of contents from each section's index.md.
// Runs in Node at config time; the result is also sent to the browser.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import MarkdownIt from 'markdown-it'

export type PageKind = 'written' | 'soon' | 'overview' | 'quiz' | 'app'

export interface SectionDef {
  id: string
  dir: string
  title: string
  nav: string
  // The framework overview is a page you read, so it's listed and tracked.
  overviewIsPage?: boolean
  numbered?: boolean
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'framework',
    dir: 'learn/framework',
    title: 'Interview framework',
    nav: 'Framework',
    overviewIsPage: true,
    numbered: true,
  },
  { id: 'foundations', dir: 'learn/foundations', title: 'Foundations', nav: 'Foundations' },
  { id: 'toolbox', dir: 'learn/toolbox', title: 'Toolbox', nav: 'Toolbox' },
  { id: 'playbook', dir: 'learn/playbook', title: 'Playbook', nav: 'Playbook' },
  { id: 'designs', dir: 'designs', title: 'Designs', nav: 'Designs' },
]

export interface CatalogPage {
  path: string
  link: string
  label: string
  title: string
  summary?: string
  kind: 'written' | 'soon'
  section: string
  quiz?: string
}

export interface CatalogSection {
  id: string
  title: string
  nav: string
  summary?: string
  overviewLink: string
  overviewPath: string
  pages: CatalogPage[]
}

export interface IndexLink {
  target: string
  text: string
  summary?: string
}

// Parse with markdown-it, like VitePress, so comments, code and every link form behave the same.
const md = new MarkdownIt({ html: true })
type Token = ReturnType<MarkdownIt['parse']>[number]

const FRONTMATTER = /^---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/

function blocks(src: string): Token[] {
  const body = src.replace(/^﻿/, '').replace(FRONTMATTER, '')
  // HTML comments carry no content, so they're ignored everywhere.
  return md.parse(body, {}).filter((t) => !(t.type === 'html_block' && /^\s*<!--/.test(t.content)))
}

function plainText(tokens: Token[]): string {
  return tokens
    .map((t) => {
      if (t.type === 'text' || t.type === 'code_inline') return t.content
      return t.type === 'softbreak' || t.type === 'hardbreak' ? ' ' : ''
    })
    .join('')
}

/** The `# Title` that opens the page, or undefined if the page doesn't start with one. */
export function titleOf(src: string): string | undefined {
  const [open, inline] = blocks(src)
  if (open?.type !== 'heading_open' || open.tag !== 'h1') return undefined
  return plainText(inline?.children ?? []).trim() || undefined
}

/** The first sentence of the first paragraph, as plain text. */
export function firstSentence(src: string): string | undefined {
  const tokens = blocks(src)
  // List items wrap their text in hidden paragraphs; only a real intro paragraph counts.
  const at = tokens.findIndex((t) => t.type === 'paragraph_open' && !t.hidden)
  if (at === -1) return undefined
  const text = plainText(tokens[at + 1]?.children ?? [])
    .replace(/\s+/g, ' ')
    .trim()
  // A sentence ends at . ! or ? before a capital letter or the end, unless it closes an
  // abbreviation like "e.g.", so "e.g. Redis" stays whole.
  for (const m of text.matchAll(/[.!?](?=\s+[A-Z]|$)/g)) {
    const end = m.index + 1
    if (!/\b(?:e\.g|i\.e|etc|vs|approx)\.$/i.test(text.slice(0, end))) return text.slice(0, end)
  }
  return text || undefined
}

/** True when the page has nothing after its `# Title`. */
export function isComingSoon(src: string): boolean {
  const tokens = blocks(src)
  const titleEnd = tokens.findIndex((t) => t.type === 'heading_close' && t.tag === 'h1')
  return titleEnd !== -1 && tokens.length === titleEnd + 1
}

/**
 * Links from a section index to `.md` files inside the section, in order of first
 * appearance. `indexDir` is the index's folder relative to the content root.
 */
export function parseIndexLinks(src: string, indexDir: string): IndexLink[] {
  const seen = new Set<string>()
  const links: IndexLink[] = []
  let listDepth = 0
  for (const block of blocks(src)) {
    if (block.type === 'list_item_open') listDepth++
    if (block.type === 'list_item_close') listDepth--
    if (block.type !== 'inline') continue
    const children = block.children ?? []
    children.forEach((child, i) => {
      if (child.type !== 'link_open') return
      const href = decodeURI(child.attrGet('href') ?? '').split('#', 1)[0] ?? ''
      if (!href.endsWith('.md') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return
      const target = href.startsWith('/')
        ? posix.normalize(href.slice(1))
        : posix.normalize(posix.join(indexDir, href))
      const base = posix.basename(target)
      if (!target.startsWith(indexDir + '/') || base === 'index.md' || base === 'quiz.md') return
      if (seen.has(target)) return
      seen.add(target)

      const close = children.findIndex((c, j) => j > i && c.type === 'link_close')
      const text = plainText(children.slice(i + 1, close)).trim()
      // "- [Title](page.md): summary" — the summary follows the first link of a list item.
      const rest = plainText(children.slice(close + 1))
      const summary =
        listDepth > 0 && i === 0 ? rest.match(/^\s*:\s*([\s\S]+?)\s*$/)?.[1] : undefined
      links.push({ target, text, summary })
    })
  }
  return links
}

// VitePress renders sidebar and prev/next text as HTML.
export const escapeHtml = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;')

export function linkOf(path: string): string {
  const noExt = path.replace(/\.md$/, '')
  if (noExt === 'index') return '/'
  return '/' + (noExt.endsWith('/index') ? noExt.slice(0, -'index'.length) : noExt)
}

function listMarkdown(root: string, dir: string): string[] {
  const full = join(root, dir)
  return readdirSync(full).flatMap((name) => {
    const rel = posix.join(dir, name)
    if (statSync(join(root, rel)).isDirectory()) return listMarkdown(root, rel)
    return name.endsWith('.md') ? [rel] : []
  })
}

/** Reads every section and validates it. Throws one error listing every problem. */
export function loadCatalog(contentDir: string, sections = SECTIONS): CatalogSection[] {
  const problems: string[] = []
  const read = (path: string) => readFileSync(join(contentDir, path), 'utf8')

  const result = sections.map((def): CatalogSection => {
    const indexPath = `${def.dir}/index.md`
    const section: CatalogSection = {
      id: def.id,
      title: def.title,
      nav: def.nav,
      overviewLink: linkOf(indexPath),
      overviewPath: indexPath,
      pages: [],
    }
    if (!existsSync(join(contentDir, indexPath))) {
      problems.push(`${indexPath}: missing section index`)
      return section
    }
    const indexSrc = read(indexPath)
    section.summary = firstSentence(indexSrc)
    const links = parseIndexLinks(indexSrc, def.dir)

    if (def.overviewIsPage) {
      const title = titleOf(indexSrc)
      if (!title) problems.push(`${indexPath}: must start with a "# Title" line`)
      section.pages.push({
        path: indexPath,
        link: section.overviewLink,
        label: 'Overview',
        title: title ?? def.title,
        kind: 'written',
        section: def.id,
      })
    }

    links.forEach((link, i) => {
      if (!existsSync(join(contentDir, link.target))) {
        problems.push(`${indexPath}: links to a missing page: ${link.target}`)
        return
      }
      const src = read(link.target)
      const title = titleOf(src)
      if (!title) problems.push(`${link.target}: must start with a "# Title" line`)
      const quiz = posix.join(posix.dirname(link.target), 'quiz.md')
      section.pages.push({
        path: link.target,
        link: linkOf(link.target),
        label: def.numbered ? `${i + 1}. ${link.text}` : link.text,
        title: title ?? link.text,
        summary: link.summary,
        kind: isComingSoon(src) ? 'soon' : 'written',
        section: def.id,
        quiz: existsSync(join(contentDir, quiz)) ? quiz : undefined,
      })
    })

    const listed = new Set(links.map((l) => l.target))
    for (const file of listMarkdown(contentDir, def.dir)) {
      const base = posix.basename(file)
      if (base === 'index.md' || base === 'quiz.md' || listed.has(file)) continue
      problems.push(`${file}: not linked from ${indexPath}`)
    }
    return section
  })

  if (problems.length > 0) {
    throw new Error(`Book structure problems:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  }
  return result
}

/** What kind of page a content path is, using the catalog. */
export function kindOf(path: string, catalog: CatalogSection[]): PageKind {
  if (path === 'index.md' || path === 'progress.md') return 'app'
  if (posix.basename(path) === 'quiz.md') return 'quiz'
  for (const section of catalog) {
    const page = section.pages.find((p) => p.path === path)
    if (page) return page.kind
    if (section.overviewPath === path) return 'overview'
  }
  return 'app'
}

export interface NavLink {
  text: string
  link: string
}

/** Previous and next readable pages in book order, skipping coming-soon pages. */
export function neighbours(
  path: string,
  catalog: CatalogSection[],
): { prev?: NavLink; next?: NavLink } {
  const order: { path: string; text: string; link: string; soon: boolean }[] = []
  for (const section of catalog) {
    if (!section.pages.some((p) => p.path === section.overviewPath)) {
      order.push({
        path: section.overviewPath,
        text: section.title,
        link: section.overviewLink,
        soon: false,
      })
    }
    for (const p of section.pages) {
      order.push({ path: p.path, text: p.label, link: p.link, soon: p.kind === 'soon' })
    }
  }
  const at = order.findIndex((o) => o.path === path)
  if (at === -1) return {}
  const prev = order
    .slice(0, at)
    .reverse()
    .find((o) => !o.soon)
  const next = order.slice(at + 1).find((o) => !o.soon)
  return {
    prev: prev && { text: escapeHtml(prev.text), link: prev.link },
    next: next && { text: escapeHtml(next.text), link: next.link },
  }
}
