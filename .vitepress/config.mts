import { existsSync, readFileSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfigWithTheme, type DefaultTheme } from 'vitepress'
import { kindOf, loadCatalog, neighbours, type CatalogSection } from './lib/catalog.ts'
import {
  diagramHash,
  diagramHtml,
  isMermaid,
  mermaidBlocks,
  renderDiagrams,
  summary,
} from './lib/mermaid.ts'
import { buildNav, buildSidebar } from './lib/sidebar.ts'
import { figureHtml, localSvgBaseWidth, markFigures } from './lib/figure.ts'
import { slugify } from './lib/slug.ts'

export interface ThemeConfig extends DefaultTheme.Config {
  catalog: CatalogSection[]
}

const BASE = '/system-designs/'
const contentDir = fileURLToPath(new URL('../content', import.meta.url))
const configFile = fileURLToPath(import.meta.url)
const diagramsDir = join(contentDir, 'public', 'diagrams')
const catalog = loadCatalog(contentDir)

// The catalog is read once at startup. In dev, restart when a content change alters it.
// Vite's server.restart() leaves VitePress's search index behind, so we touch this file
// instead, which makes VitePress do its own full restart.
function catalogReload(): Plugin {
  return {
    name: 'book-catalog-reload',
    configureServer(server) {
      let snapshot = JSON.stringify(catalog)
      const onChange = (file: string) => {
        if (!file.endsWith('.md') || !file.startsWith(contentDir)) return
        let next: string
        try {
          next = JSON.stringify(loadCatalog(contentDir))
        } catch (error) {
          server.config.logger.error(String(error))
          return
        }
        if (next === snapshot) return
        snapshot = next
        const now = new Date()
        utimesSync(configFile, now, now)
      }
      for (const event of ['add', 'unlink', 'change']) server.watcher.on(event, onChange)
    },
  }
}

// A missing diagram fails the build; the dev server renders it on save instead.
let strictDiagrams = false
const diagramsMode: Plugin = {
  name: 'book-diagrams-mode',
  configResolved(config) {
    strictDiagrams = config.command === 'build'
  },
}

// `npm run dev` renders diagrams once at the start. After that, a saved note with a new
// diagram is rendered here, then the browser reloads to show it.
function diagramsOnSave(): Plugin {
  const pending = '\0pending-diagram:'
  return {
    name: 'book-diagrams-on-save',
    apply: 'serve',
    enforce: 'pre',
    // Vue imports each image; until the SVG exists, hand back its URL instead of failing.
    resolveId(id) {
      const hash = /^\/diagrams\/([0-9a-f]{16})\.svg$/.exec(id)?.[1]
      if (hash && !existsSync(join(diagramsDir, `${hash}.svg`))) return pending + hash
    },
    load(id) {
      if (id.startsWith(pending)) {
        return `export default ${JSON.stringify(`${BASE}diagrams/${id.slice(pending.length)}.svg`)}`
      }
    },
    configureServer(server) {
      let queue = Promise.resolve()
      const onChange = (file: string) => {
        if (!file.endsWith('.md') || !file.startsWith(contentDir) || !existsSync(file)) return
        const sources = mermaidBlocks(readFileSync(file, 'utf8'))
        if (sources.every((source) => existsSync(join(diagramsDir, `${diagramHash(source)}.svg`))))
          return
        queue = queue
          .then(async () => {
            const result = await renderDiagrams(contentDir, { prune: false, keepGoing: true })
            for (const message of result.failed) server.config.logger.error(message)
            if (result.rendered.length === 0) return
            server.config.logger.info(summary(result, contentDir))
            server.ws.send({ type: 'full-reload' })
          })
          .catch((error: unknown) => server.config.logger.error(String(error)))
      }
      for (const event of ['add', 'change']) server.watcher.on(event, onChange)
    },
  }
}

export default defineConfigWithTheme<ThemeConfig>({
  base: BASE,
  lang: 'en',
  title: 'System Design Interview',
  description:
    'A 45-minute system design interview framework, the concepts behind it, and worked designs. Works offline.',
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    anchor: { slugify },
    config(md) {
      const fence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        if (token && isMermaid(token.info)) {
          const page = env.relativePath
          return diagramHtml(token.content, { diagramsDir, page, strict: strictDiagrams })
        }
        return fence
          ? fence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }

      // An image alone in a real paragraph (not a table cell, heading, tight list item or
      // link) becomes a figure: caption from its title, and a zoom button.
      // Last, so attribute syntax like {.wide} has already been taken off the image.
      md.core.ruler.push('book-figures', (state) => markFigures(state.tokens))
      const image = md.renderer.rules.image
      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const render = () =>
          image ? image(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
        if (!token?.meta?.figure) return render()
        const caption = token.attrGet('title') || undefined
        // The caption shows under the picture; a title tooltip would repeat it.
        token.attrs = token.attrs?.filter(([name]) => name !== 'title') ?? null
        const base = localSvgBaseWidth(token.attrGet('src') ?? '', {
          contentDir,
          page: env.relativePath,
        })
        if (base) token.attrSet('data-base-width', String(base))
        const alt = self.renderInlineAsText(token.children ?? [], options, env)
        return figureHtml({ img: render(), alt, caption, block: false })
      }

      // VitePress titles GitHub alerts in capitals and ignores label options for them.
      md.renderer.rules.github_alert_open = (tokens, idx) => {
        const { title, type } = tokens[idx]?.meta as { title: string; type: string }
        const label = title === type.toUpperCase() ? title[0] + title.slice(1).toLowerCase() : title
        return `<div class="${type} custom-block github-alert"><p class="custom-block-title">${md.utils.escapeHtml(label)}</p>\n`
      }
    },
  },
  vite: {
    plugins: [catalogReload(), diagramsMode, diagramsOnSave()],
  },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}logo.svg` }]],
  themeConfig: {
    catalog,
    logo: { src: '/logo.svg', alt: '' },
    nav: buildNav(catalog),
    sidebar: buildSidebar(catalog),
    outline: { level: [2, 3] },
    search: {
      provider: 'local',
      options: {
        // Only pages with real content are worth finding.
        _render(src, env, md) {
          if (kindOf(env.relativePath, catalog) !== 'written') return ''
          const html = md.render(src, env)
          return env.frontmatter?.search === false ? '' : html
        },
      },
    },
  },
  transformPageData(pageData) {
    const kind = kindOf(pageData.relativePath, catalog)
    pageData.frontmatter.pageKind = kind
    if (kind === 'written' || kind === 'soon' || kind === 'overview') {
      const { prev, next } = neighbours(pageData.relativePath, catalog)
      pageData.frontmatter.prev ??= prev ?? false
      pageData.frontmatter.next ??= next ?? false
    } else if (kind === 'quiz') {
      pageData.frontmatter.prev = false
      pageData.frontmatter.next = false
    }
  },
})
