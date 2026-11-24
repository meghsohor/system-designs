import { existsSync, readdirSync, readFileSync, utimesSync } from 'node:fs'
import { join, posix, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withPwa } from '@vite-pwa/vitepress'
import type { Plugin } from 'vite'
import { defineConfigWithTheme, type DefaultTheme } from 'vitepress'
import {
  escapeHtml,
  kindOf,
  linkOf,
  loadCatalog,
  neighbours,
  titleOf,
  type CatalogSection,
} from './lib/catalog.ts'
import { designListRange } from './lib/design-cards.ts'
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
import { textSizeScript } from './lib/text-size.ts'
import { darkModeFallbackScript } from './lib/dark-mode.ts'
import { parseQuiz } from './lib/quiz.ts'
import { describePage, isIndexable, seoHead, type Site } from './lib/seo.ts'
import { fixLlmsLinks, llmsToc } from './lib/llms.ts'
import llmstxt from 'vitepress-plugin-llms'

export interface ThemeConfig extends DefaultTheme.Config {
  catalog: CatalogSection[]
}

const BASE = '/system-designs/'
const contentDir = fileURLToPath(new URL('../content', import.meta.url))
const configFile = fileURLToPath(import.meta.url)
const outDir = fileURLToPath(new URL('./dist', import.meta.url))
const diagramsDir = join(contentDir, 'public', 'diagrams')
const catalog = loadCatalog(contentDir)
const catalogPages = new Map(catalog.flatMap((s) => s.pages).map((p) => [p.path, p]))
const designsOverview = catalog.find((s) => s.id === 'designs')?.overviewPath

// A quiz page is only the quiz component, with the questions passed in. The catalog has
// already checked the file, so the build has failed before this on a bad quiz.
function quizHtml(src: string, quizPath: string): string {
  const { quiz } = parseQuiz(src, quizPath)
  const questions = quiz.questions.map(({ review, ...question }) => ({
    ...question,
    review: { text: review.text, link: linkOf(review.target) + (review.hash && `#${review.hash}`) },
  }))
  const props = escapeHtml(JSON.stringify({ title: quiz.title, questions })).replaceAll(
    '"',
    '&quot;',
  )
  return `<QuizRunner :quiz="${props}" />\n`
}

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

const TITLE = 'System Design Interview'
const DESCRIPTION =
  'A 45-minute system design interview framework, the concepts behind it, and worked designs. Works offline.'
const BRAND = '#0e7490'
const REPO_FILES = 'https://github.com/meghsohor/system-designs/blob/main/content'
const SITE: Site = {
  url: `https://meghsohor.github.io${BASE.slice(0, -1)}`,
  name: TITLE,
  description: DESCRIPTION,
  image: {
    path: 'og.png',
    width: 1200,
    height: 630,
    alt: 'System Design Interview: the eight steps of a 45-minute interview, from Understand to Wrap-up',
  },
}
// Written pages, section overviews and the home page, as sitemap URLs (no leading slash).
const indexableUrls = new Set(
  catalog
    .flatMap((s) => [
      ...s.pages.filter((p) => isIndexable(p.path, p.kind)).map((p) => p.link),
      s.overviewLink,
    ])
    .concat('/')
    .map((link) => link.slice(1)),
)
// Only written pages are offered to AI agents.
const notForAgents = readdirSync(contentDir, { recursive: true, encoding: 'utf8' })
  .map((file) => file.split(sep).join('/'))
  .filter((path) => path.endsWith('.md') && !path.startsWith('public/'))
  .filter((path) => kindOf(path, catalog) !== 'written')

const config = defineConfigWithTheme<ThemeConfig>({
  base: BASE,
  lang: 'en',
  title: TITLE,
  titleTemplate: `:title · ${TITLE}`,
  description: DESCRIPTION,
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,
  vue: {
    // A browser element (styled select menus), not a Vue component.
    template: { compilerOptions: { isCustomElement: (tag) => tag === 'selectedcontent' } },
  },
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

      // Quiz pages become the quiz; written pages get "Listen" (and a quiz button) under the title.
      md.core.ruler.push('book-quiz', (state) => {
        const path: string = state.env?.relativePath ?? ''
        if (posix.basename(path) === 'quiz.md') {
          const token = new state.Token('html_block', '', 0)
          token.content = quizHtml(state.src, path)
          state.tokens = [token]
          return
        }
        if (catalogPages.get(path)?.kind !== 'written') return
        const titleEnd = state.tokens.findIndex((t) => t.type === 'heading_close' && t.tag === 'h1')
        if (titleEnd === -1) return
        const token = new state.Token('html_block', '', 0)
        token.content = '<PageActions />\n'
        state.tokens.splice(titleEnd + 1, 0, token)
      })

      // On the site, the Designs page's list becomes cards; GitHub still shows the list.
      md.core.ruler.push('book-design-cards', (state) => {
        if (!designsOverview || state.env?.relativePath !== designsOverview) return
        const dir = posix.dirname(designsOverview)
        const range = designListRange(
          state.tokens,
          (href) =>
            catalogPages.get(posix.join(dir, href.split('#')[0] ?? ''))?.section === 'designs',
        )
        if (!range) throw new Error(`${designsOverview}: no list of design links to show as cards`)
        const [start, end] = range
        const token = new state.Token('html_block', '', 0)
        token.content = '<DesignCards />\n'
        state.tokens.splice(start, end - start + 1, token)
      })

      // VitePress titles GitHub alerts in capitals and ignores label options for them.
      md.renderer.rules.github_alert_open = (tokens, idx) => {
        const { title, type } = tokens[idx]?.meta as { title: string; type: string }
        const label = title === type.toUpperCase() ? title[0] + title.slice(1).toLowerCase() : title
        return `<div class="${type} custom-block github-alert"><p class="custom-block-title">${md.utils.escapeHtml(label)}</p>\n`
      }
    },
  },
  vite: {
    plugins: [
      catalogReload(),
      diagramsMode,
      diagramsOnSave(),
      llmstxt({
        title: TITLE,
        description: DESCRIPTION,
        domain: 'https://meghsohor.github.io',
        ignoreFiles: notForAgents,
        customTemplateVariables: { toc: llmsToc(catalog, SITE.url) },
      }),
    ],
    resolve: {
      // Our copies of these VitePress components add progress marks; each file says what changed.
      alias: ['VPSidebarItem', 'VPDocOutlineItem', 'VPLocalNavOutlineDropdown'].map((name) => ({
        find: new RegExp(`^.*\\/${name}\\.vue$`),
        replacement: fileURLToPath(new URL(`./theme/components/${name}.vue`, import.meta.url)),
      })),
    },
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}logo.svg` }],
    ['link', { rel: 'apple-touch-icon', href: `${BASE}apple-touch-icon-180x180.png` }],
    // Older iOS opens a Home Screen site in Safari without these; newer iOS reads the manifest.
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: 'System Design' }],
    ['script', {}, textSizeScript()],
    ['script', {}, darkModeFallbackScript()],
  ],
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
  sitemap: {
    hostname: SITE.url + '/',
    transformItems: (items) => items.filter((item) => indexableUrls.has(item.url)),
  },
  // Before the service worker is made (withPwa runs this first), so it caches the fixed copies.
  buildEnd() {
    fixLlmsLinks(outDir, catalog, SITE.url, REPO_FILES)
  },
  transformHead({ pageData }) {
    const { relativePath: path, title, description, lastUpdated } = pageData
    const kind = kindOf(path, catalog)
    return seoHead({ path, kind, title, description, lastUpdated }, SITE)
  },
  transformPageData(pageData) {
    const kind = kindOf(pageData.relativePath, catalog)
    pageData.frontmatter.pageKind = kind
    // The Designs page has no outline, so its cards take the outline's column too.
    if (pageData.relativePath === designsOverview) {
      pageData.frontmatter.aside ??= false
      pageData.frontmatter.pageClass = [pageData.frontmatter.pageClass, 'designs-page']
        .filter(Boolean)
        .join(' ')
    }
    // The home page's title is the site name alone.
    if (pageData.relativePath === 'index.md') pageData.titleTemplate = false
    pageData.description ||=
      describePage(
        pageData.relativePath,
        readFileSync(join(contentDir, pageData.relativePath), 'utf8'),
        catalog,
      ) ?? DESCRIPTION
    if (kind === 'written' || kind === 'soon' || kind === 'overview') {
      const { prev, next } = neighbours(pageData.relativePath, catalog)
      pageData.frontmatter.prev ??= prev ?? false
      pageData.frontmatter.next ??= next ?? false
    } else if (kind === 'quiz') {
      // The page has no markdown heading left to take the title from.
      pageData.title = titleOf(readFileSync(join(contentDir, pageData.relativePath), 'utf8')) ?? ''
      Object.assign(pageData.frontmatter, {
        layout: 'page',
        sidebar: false,
        prev: false,
        next: false,
      })
    }
  },
  pwa: {
    // A new version waits until the reader presses Reload (see theme/pwa.ts).
    registerType: 'prompt',
    injectRegister: false,
    // The plugin's default is relative to srcDir (content/), not to this folder.
    outDir,
    // The PNG glob below already has them.
    includeManifestIcons: false,
    manifest: {
      id: BASE,
      name: TITLE,
      short_name: 'System Design',
      description: DESCRIPTION,
      lang: 'en',
      start_url: BASE,
      scope: BASE,
      display: 'standalone',
      theme_color: BRAND,
      background_color: '#ffffff',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      // Every page, the search index, fonts and diagrams. Clean URLs map to their .html files.
      // The plugin adds the manifest itself.
      // The .md copies are small and let "Copy page as markdown" work offline.
      globPatterns: ['**/*.{html,js,css,woff2,svg,png,md}'],
      // Only link previews use it.
      globIgnores: ['og.png'],
      // Unknown addresses go to the network, so files such as llms.txt are never answered with a page.
      navigateFallback: null,
      // The site uses no query strings, so a shared link with one still opens offline.
      ignoreURLParametersMatching: [/.*/],
      // The first install takes over the open page, so it works offline without a reload.
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    },
  },
})

export default withPwa(config)
