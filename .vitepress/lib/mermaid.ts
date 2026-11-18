import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, sep } from 'node:path'
import MarkdownIt from 'markdown-it'
import { escapeAttr, figureHtml } from './figure.ts'

// Part of every diagram's hash, so changing a setting or upgrading Mermaid re-renders all diagrams.
const MERMAID_VERSION: string = createRequire(import.meta.url)('mermaid/package.json').version
export const RENDER_SETTINGS = {
  backgroundColor: 'transparent',
  mermaidConfig: {
    theme: 'default',
    fontFamily: 'Arial, Helvetica, sans-serif',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  },
} as const

const DIAGRAM_FILE = /^[0-9a-f]{16}\.svg(?:\.tmp)?$/
const parser = new MarkdownIt({ html: true })

export function isMermaid(info: string): boolean {
  return info.trim().split(/\s+/)[0] === 'mermaid'
}

/** The source of each ```mermaid block, exactly as markdown-it hands it to the fence rule. */
export function mermaidBlocks(markdown: string): string[] {
  return parser
    .parse(markdown, {})
    .filter((token) => token.type === 'fence' && isMermaid(token.info))
    .map((token) => token.content)
}

export function diagramHash(source: string): string {
  return createHash('sha256')
    .update(JSON.stringify({ source, settings: RENDER_SETTINGS, mermaid: MERMAID_VERSION }))
    .digest('hex')
    .slice(0, 16)
}

/** The diagram's accessible title (`accTitle: …`): its alt text and caption. */
export function diagramTitle(source: string): string | undefined {
  return /^\s*accTitle\s*:\s*(.+?)\s*$/m.exec(source)?.[1]
}

function rootTag(svg: string): RegExpExecArray {
  const tag = /<svg\b[^>]*>/.exec(svg)
  if (!tag) throw new Error('Not an SVG: no <svg> tag')
  return tag
}

/** mmdc writes width="100%", which gives an <img> no natural size; use the viewBox instead. */
export function withNaturalSize(svg: string): string {
  const tag = rootTag(svg)
  const viewBox = /\sviewBox="([^"]*)"/.exec(tag[0])?.[1]
  const [, , width, height] = (viewBox ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`SVG has no usable viewBox: ${viewBox ?? 'missing'}`)
  }
  const sized = tag[0]
    .replace(/\s(?:width|height)="[^"]*"/g, '')
    .replace(/^<svg\b/, `<svg width="${Math.ceil(width)}" height="${Math.ceil(height)}"`)
  return svg.slice(0, tag.index) + sized + svg.slice(tag.index + tag[0].length)
}

export function svgSize(svg: string): { width: number; height: number } {
  const tag = rootTag(svg)[0]
  const width = Number(/\swidth="(\d+)"/.exec(tag)?.[1])
  const height = Number(/\sheight="(\d+)"/.exec(tag)?.[1])
  if (!width || !height) throw new Error('SVG has no width and height in pixels')
  return { width, height }
}

/**
 * The HTML that replaces a ```mermaid block: the pre-rendered SVG. A missing SVG throws when
 * `strict` (the build). On the dev server the image goes in without its size: VitePress caches
 * this HTML, and the browser reloads once the SVG is rendered.
 */
export function diagramHtml(
  source: string,
  { diagramsDir, page, strict }: { diagramsDir: string; page: string; strict: boolean },
): string {
  const hash = diagramHash(source)
  const file = join(diagramsDir, `${hash}.svg`)
  let size = ''
  if (existsSync(file)) {
    const { width, height } = svgSize(readFileSync(file, 'utf8'))
    size = ` width="${width}" height="${height}"`
  } else if (strict) {
    throw new Error(`Diagram ${hash} in ${page} isn't rendered: run npm run diagrams`)
  }
  const caption = diagramTitle(source)
  const alt = caption ?? 'Diagram'
  const img = `<img src="/diagrams/${hash}.svg"${size} alt="${escapeAttr(alt)}" loading="lazy" decoding="async">`
  return figureHtml({ img, alt, caption, block: true })
}

interface Block {
  source: string
  pages: string[]
}

function collectBlocks(contentDir: string): Map<string, Block> {
  const blocks = new Map<string, Block>()
  const pages = readdirSync(contentDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.md') && !path.startsWith(`public${sep}`))
    .sort()
  for (const page of pages) {
    for (const source of mermaidBlocks(readFileSync(join(contentDir, page), 'utf8'))) {
      const hash = diagramHash(source)
      const block = blocks.get(hash) ?? { source, pages: [] }
      if (!block.pages.includes(page)) block.pages.push(page)
      blocks.set(hash, block)
    }
  }
  return blocks
}

export interface RenderResult {
  rendered: string[]
  removed: string[]
  failed: string[]
}

/**
 * Renders every block that has no SVG yet. With `prune`, deletes SVGs no block uses.
 * A block that fails to render throws, unless `keepGoing` (the dev server), which records it
 * in `failed` and renders the rest.
 */
export async function renderDiagrams(
  contentDir: string,
  { prune, keepGoing = false }: { prune: boolean; keepGoing?: boolean },
): Promise<RenderResult> {
  const diagramsDir = join(contentDir, 'public', 'diagrams')
  const blocks = collectBlocks(contentDir)
  const missing = [...blocks].filter(([hash]) => !existsSync(join(diagramsDir, `${hash}.svg`)))
  const result: RenderResult = { rendered: [], removed: [], failed: [] }

  if (missing.length > 0) {
    mkdirSync(diagramsDir, { recursive: true })
    // Loaded only when needed: they pull in Puppeteer and Chrome.
    const { renderMermaid } = await import('@mermaid-js/mermaid-cli')
    const { default: puppeteer } = await import('puppeteer')
    const browser = await puppeteer.launch({
      headless: true,
      // GitHub's runners can't use Chrome's sandbox.
      args: process.env.CI ? ['--no-sandbox'] : [],
    })
    try {
      for (const [hash, block] of missing) {
        let svg: string
        try {
          const { data } = await renderMermaid(browser, block.source, 'svg', {
            ...RENDER_SETTINGS,
            mermaidConfig: structuredClone(RENDER_SETTINGS.mermaidConfig),
            svgId: `diagram-${hash}`,
          })
          svg = withNaturalSize(new TextDecoder().decode(data))
        } catch (error) {
          const message = `Couldn't render a diagram in ${block.pages.join(', ')}: ${String(error)}`
          if (!keepGoing) throw new Error(message, { cause: error })
          result.failed.push(message)
          continue
        }
        const file = join(diagramsDir, `${hash}.svg`)
        writeFileSync(`${file}.tmp`, svg)
        renameSync(`${file}.tmp`, file)
        result.rendered.push(hash)
      }
    } finally {
      await browser.close()
    }
  }

  if (prune && existsSync(diagramsDir)) {
    for (const name of readdirSync(diagramsDir)) {
      if (DIAGRAM_FILE.test(name) && (name.endsWith('.tmp') || !blocks.has(name.slice(0, 16)))) {
        unlinkSync(join(diagramsDir, name))
        result.removed.push(name)
      }
    }
  }
  return result
}

export function summary(result: RenderResult, contentDir: string): string {
  const dir = relative(process.cwd(), join(contentDir, 'public', 'diagrams'))
  const failed = result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
  return `Diagrams: ${result.rendered.length} rendered, ${result.removed.length} removed${failed} (${dir})`
}
