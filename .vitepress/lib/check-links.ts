import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative } from 'node:path'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
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

/** Every internal link, image and #anchor in the built site that points nowhere. */
export function checkSite(dist: string, base: string): { pages: number; problems: string[] } {
  const idCache = new Map<string, Set<string>>()
  const idsOf = (file: string): Set<string> => {
    let ids = idCache.get(file)
    if (!ids) {
      const html = readFileSync(file, 'utf8')
      ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeAttr(m[1] ?? '')))
      idCache.set(file, ids)
    }
    return ids
  }
  const resolveTarget = (sitePath: string): string | undefined => {
    const clean = sitePath.replace(/^\/+/, '')
    const candidates =
      clean === '' || clean.endsWith('/')
        ? [`${clean}index.html`]
        : [clean, `${clean}.html`, `${clean}/index.html`]
    return candidates.map((c) => join(dist, c)).find((c) => existsSync(c) && statSync(c).isFile())
  }

  const problems: string[] = []
  const pages = walk(dist).filter((f) => f.endsWith('.html'))
  for (const page of pages) {
    const html = readFileSync(page, 'utf8')
    const pageSitePath = base + relative(dist, page).split('\\').join('/')
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
        if (!absolute.startsWith(base)) {
          problems.push(`${page}: link outside the base path: ${raw}`)
          continue
        }
        const sitePath = safeDecode(absolute.slice(base.length))
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
  return { pages: pages.length, problems }
}
