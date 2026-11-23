// The files for AI agents (llms.txt, llms-full.txt and a .md copy of each written page) are
// made by vitepress-plugin-llms. This adds our contents list and makes their links absolute.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { linkOf, type CatalogSection } from './catalog.ts'
import { mdCopyPath } from './md-copy.ts'

export { mdCopyPath }

/** Written pages by section, linking to their .md copies; sections with none are left out. */
export function llmsToc(catalog: CatalogSection[], siteUrl: string): string {
  return catalog
    .map((section) => {
      const items = section.pages
        .filter((p) => p.kind === 'written')
        .map((p) => {
          const text = p.path === section.overviewPath ? p.title : p.label
          const summary = p.summary ? `: ${p.summary}` : ''
          return `- [${text}](${siteUrl}/${mdCopyPath(p.link)})${summary}`
        })
      return items.length ? `### ${section.title}\n\n${items.join('\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

export interface LinkContext {
  siteUrl: string
  /** Content paths of written pages, which have a .md copy. */
  written: Set<string>
  /** The URL of a file the page uses, such as an image, by its content path. */
  fileUrl: (path: string) => string
}

/**
 * Rewrites relative links and images to full URLs. The copies live at other paths than their
 * sources and are read on their own, so a relative link would point to the wrong place.
 * Links to written pages go to their .md copy, other pages to the web page.
 */
export function absoluteLinks(markdown: string, sourcePath: string, ctx: LinkContext): string {
  const { siteUrl, written } = ctx
  const dir = posix.dirname(sourcePath)
  const resolve = (href: string): string => {
    if (/^[a-z][a-z0-9+.-]*:|^#|^\/\//i.test(href)) return href
    const [target = '', hash = ''] = href.split(/(?=#)/)
    const path = posix.normalize(
      target.startsWith('/') ? target.slice(1) : posix.join(dir, decodeURI(target)),
    )
    if (!path.endsWith('.md')) return ctx.fileUrl(path) + hash
    if (written.has(path)) return `${siteUrl}/${mdCopyPath(linkOf(path))}${hash}`
    return `${siteUrl}${linkOf(path)}${hash}`
  }
  // Inline links and images only, outside fenced code; the notes use no reference links.
  let fence: string | undefined
  return markdown
    .split('\n')
    .map((line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) {
        fence = fence ? undefined : marker
        return line
      }
      if (fence) return line
      return line.replace(
        /(!?\[[^\]]*\]\()(<[^>]*>|[^)\s]+)/g,
        (_, open: string, href: string) =>
          open + (href.startsWith('<') ? `<${resolve(href.slice(1, -1))}>` : resolve(href)),
      )
    })
    .join('\n')
}

/** The page's built HTML file: `/learn/framework/` → `learn/framework/index.html`. */
const htmlPath = (link: string): string =>
  link.endsWith('/') ? `${link.slice(1)}index.html` : `${link.slice(1)}.html`

/**
 * The build renames a note's images (`redirect.svg` → `assets/redirect.BJljsFS7.svg`), so
 * their URLs are read from the built page. Anything else (an image small enough to be inlined,
 * a source file) goes to the repo on GitHub, images as the raw file.
 */
export function builtFileUrl(
  html: string,
  path: string,
  siteUrl: string,
  repoFileUrl: string,
): string {
  const name = posix.basename(path)
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (const [, src = ''] of html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)) {
    const file = src.split('/').pop() ?? ''
    if (file.startsWith(stem + '.') && file.endsWith(ext) && /\/assets\//.test(src))
      return new URL(src, siteUrl).href
  }
  const raw = /\.(svg|png|jpe?g|gif|webp|avif)$/i.test(path) ? '?raw=true' : ''
  return `${repoFileUrl}/${encodeURI(path)}${raw}`
}

/** Rewrites the links in every .md copy and in llms-full.txt. Runs after pages are rendered. */
export function fixLlmsLinks(
  outDir: string,
  catalog: CatalogSection[],
  siteUrl: string,
  repoFileUrl: string,
): void {
  const pages = catalog.flatMap((s) => s.pages).filter((p) => p.kind === 'written')
  const written = new Set(pages.map((p) => p.path))
  const contexts = new Map(
    pages.map((p) => {
      const htmlFile = join(outDir, htmlPath(p.link))
      const html = existsSync(htmlFile) ? readFileSync(htmlFile, 'utf8') : ''
      const fileUrl = (path: string) => builtFileUrl(html, path, siteUrl, repoFileUrl)
      return [p.path, { siteUrl, written, fileUrl }]
    }),
  )
  const sourceOfUrl = new Map(pages.map((p) => [`${siteUrl}/${mdCopyPath(p.link)}`, p.path]))
  const fix = (markdown: string, path: string) => {
    const ctx = contexts.get(path)
    return ctx ? absoluteLinks(markdown, path, ctx) : markdown
  }

  for (const page of pages) {
    const file = join(outDir, mdCopyPath(page.link))
    if (existsSync(file)) writeFileSync(file, fix(readFileSync(file, 'utf8'), page.path))
  }

  // llms-full.txt is every copy in a row, each opening with a `url:` front matter block.
  const full = join(outDir, 'llms-full.txt')
  if (!existsSync(full)) return
  const parts = readFileSync(full, 'utf8').split(/(?=^---\nurl: )/m)
  const fixed = parts.map((part) => {
    const source = sourceOfUrl.get(/^---\nurl: (\S+)/.exec(part)?.[1] ?? '')
    return source ? fix(part, source) : part
  })
  writeFileSync(full, fixed.join(''))
}
