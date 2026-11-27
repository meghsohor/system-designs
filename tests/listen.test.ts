import { describe, expect, it } from 'vitest'
import { flatten, sentences } from '../.vitepress/theme/listen/text.ts'
import {
  bookVoices,
  parseSettings,
  pickVoice,
  voiceLabels,
  type VoiceLike,
} from '../.vitepress/theme/listen/voices.ts'

const parts = (text: string, max?: number) => sentences(text, max).map(([s, e]) => text.slice(s, e))

describe('flatten', () => {
  it('collapses whitespace, drops zero-width spaces and maps characters back', () => {
    const flat = flatten(['  Cache ', '\n in  ', 'Redis​ '])
    expect(flat.text).toBe('Cache in Redis')
    expect(flat.text.length).toBe(flat.piece.length)
    expect(flat.piece[6]).toBe(1)
    expect(flat.offset[6]).toBe(2)
    expect(flat.piece[9]).toBe(2)
    expect(flat.offset[9]).toBe(0)
  })
})

describe('sentences', () => {
  it('splits at sentence ends', () => {
    expect(parts('It is read-heavy. Redirects must be fast! Why? Because.')).toEqual([
      'It is read-heavy.',
      'Redirects must be fast!',
      'Why?',
      'Because.',
    ])
  })

  it('keeps abbreviations, decimals, numbered headings and lowercase follow-ons together', () => {
    expect(parts('Use a cache, e.g. Redis. It holds 1.5 TB.')).toEqual([
      'Use a cache, e.g. Redis.',
      'It holds 1.5 TB.',
    ])
    expect(parts('1. Understand the problem')).toEqual(['1. Understand the problem'])
    expect(parts('About 300. That is a lot.')).toEqual(['About 300.', 'That is a lot.'])
    expect(parts('Use “quotes.” then go on.')).toEqual(['Use “quotes.” then go on.'])
  })

  it('splits a long sentence at a clause break, else a space', () => {
    const long = 'The cache absorbs repeat hits, so Redis sees far fewer requests than before'
    expect(parts(long, 40)).toEqual([
      'The cache absorbs repeat hits,',
      'so Redis sees far fewer requests than',
      'before',
    ])
    expect(parts('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('returns nothing for empty text', () => {
    expect(sentences('')).toEqual([])
  })
})

const voice = (name: string, lang: string, local = true, isDefault = false): VoiceLike => ({
  name,
  lang,
  localService: local,
  default: isDefault,
  voiceURI: name,
})

describe('voices', () => {
  const voices = [
    voice('Albert', 'en-US'),
    voice('Anna', 'de-DE', true, true),
    voice('Google UK English Female', 'en-GB', false),
    voice('Daniel', 'en-GB'),
    voice('Samantha', 'en_US'),
  ]

  it('offers English voices by name without sound effects, or all when none is English', () => {
    expect(bookVoices(voices).map((v) => v.name)).toEqual([
      'Daniel',
      'Google UK English Female',
      'Samantha',
    ])
    expect(bookVoices([voice('Anna', 'de-DE')]).map((v) => v.name)).toEqual(['Anna'])
  })

  it('keeps the saved voice, else picks an on-device English one for the reader', () => {
    const offered = bookVoices(voices)
    expect(pickVoice(offered, 'Google UK English Female', ['en-US'])?.name).toBe(
      'Google UK English Female',
    )
    expect(pickVoice(offered, 'Gone', ['en-GB'])?.name).toBe('Daniel')
    expect(pickVoice(offered, undefined, ['de-DE'])?.name).toBe('Samantha')
    expect(pickVoice([...offered, voice('Fiona', 'en-GB', true, true)], undefined, [])?.name).toBe(
      'Fiona',
    )
    expect(pickVoice([], undefined, [])).toBeUndefined()
  })

  it('shortens names and tells alike voices apart by language', () => {
    const list = [
      voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false),
      voice('Eddy (English (UK))', 'en-GB'),
      voice('Eddy (English (US))', 'en-US'),
    ]
    expect([...voiceLabels(list).values()]).toEqual([
      'Aria Online (Natural)',
      'Eddy (en-GB)',
      'Eddy (en-US)',
    ])
  })

  it('reads saved settings and ignores bad ones', () => {
    expect(parseSettings('{"speed":1.25,"voice":"Daniel"}')).toEqual({
      speed: 1.25,
      voice: 'Daniel',
    })
    expect(parseSettings('{"speed":3,"voice":""}')).toEqual({ speed: 1, voice: undefined })
    expect(parseSettings('not json')).toEqual({ speed: 1 })
    expect(parseSettings(null)).toEqual({ speed: 1 })
  })
})
