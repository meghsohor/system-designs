import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkSite } from '../.vitepress/lib/check-links.ts'

const BASE = '/site/'
let dist = ''

function site(files: Record<string, string>): string {
  dist = mkdtempSync(join(tmpdir(), 'check-links-'))
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true })
    writeFileSync(join(dist, path), body)
  }
  return dist
}

const problemsOf = (files: Record<string, string>) =>
  checkSite(site(files), BASE).problems.map((p) => p.slice(p.indexOf(': ') + 2))

afterEach(() => rmSync(dist, { recursive: true, force: true }))

describe('checkSite', () => {
  it('passes a site whose links, images and anchors all resolve', () => {
    const result = checkSite(
      site({
        'index.html': `<a href="/site/guide/intro#start">Intro</a> <img src="logo.svg">
          <a href="https://example.com/x">out</a> <a href="mailto:a@b.c">mail</a> <a href="#top">top</a>
          <h1 id="top">Home</h1>`,
        'logo.svg': '<svg/>',
        'guide/intro.html': `<h2 id="start">Start</h2> <a href="../">Home</a> <a href="./">Guide</a>`,
        'guide/index.html': '<a href="intro?x=1">Intro</a>',
      }),
      BASE,
    )
    expect(result).toEqual({ pages: 3, problems: [] })
  })

  it('reports a missing page, file and anchor', () => {
    expect(
      problemsOf({
        'index.html': `<a href="/site/nope">a</a> <img src="gone.png"> <a href="#missing">b</a>`,
      }),
    ).toEqual([
      'missing target: /site/nope',
      'missing target: gone.png',
      'missing anchor: #missing',
    ])
  })

  it('reports a link outside the base path', () => {
    expect(problemsOf({ 'index.html': '<a href="/other/page">x</a>' })).toEqual([
      'link outside the base path: /other/page',
    ])
  })

  it('reports a stray % instead of crashing', () => {
    expect(problemsOf({ 'index.html': '<a href="/site/100%">x</a> <a href="#50%">y</a>' })).toEqual(
      ['missing target: /site/100%', 'missing anchor: #50%'],
    )
  })

  it('decodes entities and percent-encoding in links and ids', () => {
    expect(
      problemsOf({
        'index.html': `<a href="/site/a%20b#caf%C3%A9">x</a> <a href="#q&amp;a">y</a> <p id="q&amp;a"></p>`,
        'a b.html': '<h2 id="café">Café</h2>',
      }),
    ).toEqual([])
  })
})
