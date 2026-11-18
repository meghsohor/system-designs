import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCALE_INDEX,
  TEXT_SCALES,
  TEXT_SIZE_KEY,
  scaleIndexOf,
  textSizeScript,
} from '../.vitepress/lib/text-size.ts'

describe('scaleIndexOf', () => {
  it('finds a saved scale and falls back to the default for anything else', () => {
    expect(scaleIndexOf('1.25')).toBe(TEXT_SCALES.indexOf(1.25))
    expect(scaleIndexOf('0.9')).toBe(0)
    for (const bad of [null, '', '2', 'abc', '1.0']) {
      expect(scaleIndexOf(bad)).toBe(DEFAULT_SCALE_INDEX)
    }
  })
})

describe('textSizeScript', () => {
  // Runs the <head> script against a fake page and returns what it set on <html>.
  const run = (getItem: (key: string) => string | null) => {
    const set: Record<string, string> = {}
    const document = {
      documentElement: { style: { setProperty: (k: string, v: string) => (set[k] = v) } },
    }
    new Function('localStorage', 'document', textSizeScript())({ getItem }, document)
    return set
  }

  it('applies a saved size before the page draws', () => {
    expect(run((key) => (key === TEXT_SIZE_KEY ? '1.4' : null))).toEqual({
      '--book-text-scale': '1.4',
    })
  })

  it('ignores the default, unknown values and blocked storage', () => {
    expect(run(() => '1')).toEqual({})
    expect(run(() => 'url(x)')).toEqual({})
    expect(
      run(() => {
        throw new Error('blocked')
      }),
    ).toEqual({})
  })
})
