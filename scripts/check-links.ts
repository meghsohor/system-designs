// Fails the build if any internal link, image or #anchor in the built site is broken.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative } from 'node:path'

const DIST = '.vitepress/dist'
const BASE = '/system-designs/'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const idCache = new Map<string, Set<string>>()
function idsOf(file: string): Set<string> {
  let ids = idCache.get(file)
  if (!ids) {
    const html = readFileSync(file, 'utf8')
    ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeAttr(m[1] ?? '')))
    idCache.set(file, ids)
  }
  return ids
}

function decodeAttr(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

// A stray % in a link is reported as a problem, not a crash.
function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function resolveTarget(sitePath: string): string | undefined {
  const clean = sitePath.replace(/^\/+/, '')
  const candidates =
    clean === '' || clean.endsWith('/')
      ? [`${clean}index.html`]
      : [clean, `${clean}.html`, `${clean}/index.html`]
  return candidates.map((c) => join(DIST, c)).find((c) => existsSync(c) && statSync(c).isFile())
}

const problems: string[] = []
const pages = walk(DIST).filter((f) => f.endsWith('.html'))

for (const page of pages) {
  const html = readFileSync(page, 'utf8')
  const pageSitePath = BASE + relative(DIST, page).split('\\').join('/')
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = decodeAttr(m[1] ?? '')
    if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue

    const [pathAndQuery = '', hash] = raw.split('#', 2)
    const path = pathAndQuery.split('?', 1)[0] ?? ''
    let target: string | undefined
    if (path === '') {
      target = page
    } else {
      const absolute = path.startsWith('/') ? path : posix.join(posix.dirname(pageSitePath), path)
      if (!absolute.startsWith(BASE)) {
        problems.push(`${page}: link outside the base path: ${raw}`)
        continue
      }
      const sitePath = safeDecode(absolute.slice(BASE.length))
      target = sitePath === undefined ? undefined : resolveTarget(sitePath)
      if (!target) {
        problems.push(`${page}: missing target: ${raw}`)
        continue
      }
    }
    if (hash && target.endsWith('.html')) {
      const id = safeDecode(hash)
      if (id === undefined || !idsOf(target).has(id)) {
        problems.push(`${page}: missing anchor: ${raw}`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    `Link check failed (${problems.length}):\n` + problems.map((p) => `  ${p}`).join('\n'),
  )
  process.exit(1)
}
console.log(`Link check passed: ${pages.length} pages.`)
