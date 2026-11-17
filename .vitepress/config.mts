import { utimesSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfigWithTheme, type DefaultTheme } from 'vitepress'
import { kindOf, loadCatalog, neighbours, type CatalogSection } from './lib/catalog.ts'
import { buildNav, buildSidebar } from './lib/sidebar.ts'
import { slugify } from './lib/slug.ts'

export interface ThemeConfig extends DefaultTheme.Config {
  catalog: CatalogSection[]
}

const contentDir = fileURLToPath(new URL('../content', import.meta.url))
const configFile = fileURLToPath(import.meta.url)
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

export default defineConfigWithTheme<ThemeConfig>({
  base: '/system-designs/',
  lang: 'en',
  title: 'System Design Interview',
  description:
    'A 45-minute system design interview framework, the concepts behind it, and worked designs. Works offline.',
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    anchor: { slugify },
  },
  vite: {
    plugins: [catalogReload()],
  },
  themeConfig: {
    catalog,
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
