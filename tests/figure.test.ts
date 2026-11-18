import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'
import { afterAll, describe, expect, it } from 'vitest'
import {
  escapeAttr,
  figureHtml,
  localSvgBaseWidth,
  markFigures,
  svgBaseWidth,
} from '../.vitepress/lib/figure.ts'

describe('escapeAttr', () => {
  it('escapes everything that could break out of an attribute', () => {
    expect(escapeAttr(`a & "b" <c>`)).toBe('a &amp; &quot;b&quot; &lt;c&gt;')
  })
})

describe('figureHtml', () => {
  const img = '<img src="./x.svg" alt="X">'

  it('keeps an inline image inside spans, so it stays valid inside a <p>', () => {
    const html = figureHtml({ img, alt: 'X', caption: 'The <big> picture', block: false })
    expect(html).toMatch(/^<span class="figure"><img src="\.\/x\.svg" alt="X"><button /)
    expect(html).toContain('aria-label="Enlarge: The &lt;big&gt; picture"')
    expect(html).toMatch(
      /<span class="figure-caption" v-pre>The &lt;big&gt; picture<\/span><\/span>$/,
    )
    expect(html).not.toMatch(/<(figure|div|p)\b/)
  })

  it('labels the button with the alt, or "image", when there is no caption', () => {
    expect(figureHtml({ img, alt: 'X', block: false })).toContain('aria-label="Enlarge: X"')
    expect(figureHtml({ img, alt: '', block: false })).toContain('aria-label="Enlarge: image"')
    expect(figureHtml({ img, alt: 'X', block: false })).not.toContain('figure-caption')
  })
})

describe('svgBaseWidth', () => {
  it('reads the viewBox width, ignoring a 2× width attribute', () => {
    expect(svgBaseWidth('<svg viewBox="0 0 2689.4 2429" width="5378.8" height="4858">')).toBe(2690)
    expect(svgBaseWidth('<svg viewBox="-8,-8,120,40">')).toBe(120)
    expect(svgBaseWidth('<svg width="100">')).toBeUndefined()
  })
})

describe('localSvgBaseWidth', () => {
  const contentDir = mkdtempSync(join(tmpdir(), 'content-'))
  mkdirSync(join(contentDir, 'designs', 'x'), { recursive: true })
  mkdirSync(join(contentDir, 'public'), { recursive: true })
  writeFileSync(join(contentDir, 'designs', 'x', 'my pic.svg'), '<svg viewBox="0 0 300 100">')
  writeFileSync(join(contentDir, 'public', 'logo.svg'), '<svg viewBox="0 0 64 64">')
  afterAll(() => rmSync(contentDir, { recursive: true, force: true }))
  const page = 'designs/x/design.md'

  it('resolves relative paths from the page and absolute ones from public/', () => {
    expect(localSvgBaseWidth('./my%20pic.svg', { contentDir, page })).toBe(300)
    expect(localSvgBaseWidth('/logo.svg', { contentDir, page })).toBe(64)
  })

  it('skips other images, remote URLs and missing files', () => {
    expect(localSvgBaseWidth('./a.png', { contentDir, page })).toBeUndefined()
    expect(localSvgBaseWidth('https://x.org/a.svg', { contentDir, page })).toBeUndefined()
    expect(localSvgBaseWidth('./gone.svg', { contentDir, page })).toBeUndefined()
    expect(localSvgBaseWidth('./bad%zz.svg', { contentDir, page })).toBeUndefined()
  })
})

describe('markFigures', () => {
  const figures = (markdown: string) => {
    const md = new MarkdownIt()
    const tokens = md.parse(markdown, {})
    markFigures(tokens)
    return tokens
      .flatMap((token) => token.children ?? [])
      .filter((token) => token.type === 'image')
      .map((token) => Boolean((token.meta as { figure?: boolean } | null)?.figure))
  }

  it('marks an image alone in its paragraph', () => {
    expect(figures('Text\n\n![a](./a.svg "Cap")\n')).toEqual([true])
  })

  it('leaves images in text, links, tables, headings and tight lists alone', () => {
    expect(figures('See ![a](./a.svg) here\n')).toEqual([false])
    expect(figures('[![a](./a.svg)](https://x.org)\n')).toEqual([false])
    expect(figures('| A |\n|---|\n| ![a](./a.svg) |\n')).toEqual([false])
    expect(figures('# ![a](./a.svg)\n')).toEqual([false])
    expect(figures('- ![a](./a.svg)\n- b\n')).toEqual([false])
  })
})
