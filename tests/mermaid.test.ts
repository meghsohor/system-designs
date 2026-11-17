import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  diagramHash,
  diagramHtml,
  diagramTitle,
  isMermaid,
  mermaidBlocks,
  renderDiagrams,
  svgSize,
  withNaturalSize,
} from '../.vitepress/lib/mermaid.ts'

// No Chrome in unit tests: a block containing "broken" fails, others render a small SVG.
vi.mock('puppeteer', () => ({ default: { launch: async () => ({ close: async () => {} }) } }))
vi.mock('@mermaid-js/mermaid-cli', () => ({
  renderMermaid: async (_browser: unknown, source: string) => {
    if (source.includes('broken')) throw new Error('Parse error')
    return { data: new TextEncoder().encode('<svg width="100%" viewBox="0 0 200 80"></svg>') }
  },
}))

describe('isMermaid', () => {
  it('matches the language, ignoring attributes and spaces', () => {
    expect(isMermaid('mermaid')).toBe(true)
    expect(isMermaid(' mermaid {title="x"}')).toBe(true)
    expect(isMermaid('mermaidjs')).toBe(false)
    expect(isMermaid('ts')).toBe(false)
    expect(isMermaid('')).toBe(false)
  })
})

describe('mermaidBlocks', () => {
  it('finds backtick, tilde and list-indented blocks, and skips other code', () => {
    const md = [
      '# Title',
      '',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '',
      '~~~mermaid',
      'flowchart TB',
      '~~~',
      '',
      '1. Step',
      '',
      '   ```mermaid',
      '   sequenceDiagram',
      '   ```',
      '',
      '```ts',
      'const a = 1',
      '```',
      '',
      '    indented code, not a fence',
    ].join('\n')
    expect(mermaidBlocks(md)).toEqual([
      'flowchart LR\n  A --> B\n',
      'flowchart TB\n',
      'sequenceDiagram\n',
    ])
  })

  it('returns the same source the site renderer sees, so hashes match', () => {
    const md = '- item\n\n  ```mermaid\n  flowchart LR\n    A --> B\n  ```\n'
    const seen: string[] = []
    const site = new MarkdownIt()
    site.renderer.rules.fence = (tokens, idx) => {
      seen.push(tokens[idx]?.content ?? '')
      return ''
    }
    site.render(md)
    expect(mermaidBlocks(md)).toEqual(seen)
  })
})

describe('diagramHash', () => {
  it('is 16 hex characters, stable, and changes with the source', () => {
    const a = diagramHash('flowchart LR\n')
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(diagramHash('flowchart LR\n')).toBe(a)
    expect(diagramHash('flowchart TB\n')).not.toBe(a)
  })
})

describe('diagramTitle', () => {
  it('uses accTitle when present', () => {
    expect(diagramTitle('flowchart LR\n  accTitle: Create a short URL \n  A --> B\n')).toBe(
      'Create a short URL',
    )
    expect(diagramTitle('flowchart LR\n  A --> B\n')).toBe('Diagram')
  })
})

describe('withNaturalSize', () => {
  const svg =
    '<svg id="d" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 120.5px;" viewBox="-8 -8 120.5 40.2"><path stroke-width="2" width="3"/></svg>'

  it('sets width and height on the root from the viewBox, rounded up', () => {
    const out = withNaturalSize(svg)
    expect(out).toMatch(/^<svg width="121" height="41" id="d" xmlns=/)
    expect(out).not.toContain('width="100%"')
    expect(out).toContain('<path stroke-width="2" width="3"/>')
    expect(svgSize(out)).toEqual({ width: 121, height: 41 })
  })

  it('throws without a usable viewBox', () => {
    expect(() => withNaturalSize('<svg width="100%"></svg>')).toThrow(/viewBox/)
    expect(() => withNaturalSize('<svg viewBox="0 0 0 10"></svg>')).toThrow(/viewBox/)
    expect(() => withNaturalSize('<div></div>')).toThrow(/Not an SVG/)
  })
})

describe('diagramHtml', () => {
  const source = 'flowchart LR\n  accTitle: A "quoted" <title>\n  A --> B\n'
  const page = 'designs/x/design.md'
  let diagramsDir: string

  beforeEach(() => {
    diagramsDir = mkdtempSync(join(tmpdir(), 'diagrams-'))
  })
  afterEach(() => {
    rmSync(diagramsDir, { recursive: true, force: true })
  })

  it('renders an image with the size from the SVG and an escaped alt', () => {
    const hash = diagramHash(source)
    writeFileSync(
      join(diagramsDir, `${hash}.svg`),
      '<svg width="300" height="120" viewBox="0 0 300 120"></svg>',
    )
    expect(diagramHtml(source, { diagramsDir, page, strict: true })).toBe(
      `<div class="diagram" style="--diagram-width: 300px"><img src="/diagrams/${hash}.svg" width="300" height="120" alt="A &quot;quoted&quot; &lt;title&gt;" loading="lazy" decoding="async"></div>\n`,
    )
  })

  it('fails the build when the SVG is missing', () => {
    expect(() => diagramHtml(source, { diagramsDir, page, strict: true })).toThrow(
      /in designs\/x\/design\.md isn't rendered/,
    )
  })

  it('keeps the image without a size on the dev server when the SVG is missing', () => {
    const hash = diagramHash(source)
    expect(diagramHtml(source, { diagramsDir, page, strict: false })).toContain(
      `<img src="/diagrams/${hash}.svg" alt=`,
    )
  })
})

describe('renderDiagrams', () => {
  let contentDir: string
  let diagramsDir: string
  const good = 'flowchart LR\n  A --> B\n'
  const broken = 'flowchart LR\n  broken\n'

  beforeEach(() => {
    contentDir = mkdtempSync(join(tmpdir(), 'content-'))
    diagramsDir = join(contentDir, 'public', 'diagrams')
    mkdirSync(diagramsDir, { recursive: true })
    const page = (source: string) => '# Page\n\n```mermaid\n' + source + '```\n'
    writeFileSync(join(contentDir, 'a.md'), page(broken))
    writeFileSync(join(contentDir, 'b.md'), page(good))
  })
  afterEach(() => {
    rmSync(contentDir, { recursive: true, force: true })
  })

  it('throws on a block that fails to render', async () => {
    await expect(renderDiagrams(contentDir, { prune: false })).rejects.toThrow(
      /Couldn't render a diagram in a\.md/,
    )
  })

  it('with keepGoing, reports the failure and renders the rest with a natural size', async () => {
    const result = await renderDiagrams(contentDir, { prune: false, keepGoing: true })
    expect(result.failed).toEqual([expect.stringMatching(/in a\.md: Error: Parse error/)])
    expect(result.rendered).toEqual([diagramHash(good)])
    const svg = readFileSync(join(diagramsDir, `${diagramHash(good)}.svg`), 'utf8')
    expect(svgSize(svg)).toEqual({ width: 200, height: 80 })
  })

  it('prunes unused diagrams and leftover temp files, and nothing else', async () => {
    const unused = '0123456789abcdef.svg'
    const leftover = 'fedcba9876543210.svg.tmp'
    for (const name of [unused, leftover, 'notes.txt']) {
      writeFileSync(join(diagramsDir, name), '')
    }
    const result = await renderDiagrams(contentDir, { prune: true, keepGoing: true })
    expect(result.removed.sort()).toEqual([leftover, unused].sort())
    expect(readdirSync(diagramsDir).sort()).toEqual([`${diagramHash(good)}.svg`, 'notes.txt'])
    expect(existsSync(join(diagramsDir, unused))).toBe(false)
  })
})
