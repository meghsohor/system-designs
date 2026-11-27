// Choosing and listing the device's speech voices. Typed loosely so tests can pass plain objects.

export interface VoiceLike {
  name: string
  lang: string
  localService: boolean
  default: boolean
  voiceURI: string
}

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const
export const LISTEN_KEY = 'sdi:listen:v1'

export interface ListenSettings {
  speed: number
  voice?: string
}

/** Reads saved settings, ignoring anything that doesn't fit. */
export function parseSettings(raw: string | null): ListenSettings {
  try {
    const data: unknown = raw ? JSON.parse(raw) : undefined
    if (!data || typeof data !== 'object') return { speed: 1 }
    const { speed, voice } = data as Record<string, unknown>
    return {
      speed: SPEEDS.find((s) => s === speed) ?? 1,
      voice: typeof voice === 'string' && voice ? voice : undefined,
    }
  } catch {
    return { speed: 1 }
  }
}

const isEnglish = (v: VoiceLike) => /^en(?:[-_]|$)/i.test(v.lang)
const langOf = (v: VoiceLike) => v.lang.replace('_', '-').toLowerCase()

// macOS sound-effect voices, left out of the list.
const NOVELTY = new Set(
  'Albert,Bad News,Bahh,Bells,Boing,Bubbles,Cellos,Deranged,Good News,Hysterical,Jester,Organ,Pipe Organ,Superstar,Trinoids,Whisper,Wobble,Zarvox'.split(
    ',',
  ),
)

const isNovelty = (v: VoiceLike) => NOVELTY.has(v.name.split(' (')[0] ?? v.name)

/** The voices offered for this English book: English ones by name, or every voice if none is. */
export function bookVoices<V extends VoiceLike>(all: readonly V[]): V[] {
  const english = all.filter((v) => isEnglish(v) && !isNovelty(v))
  return (english.length > 0 ? english : [...all]).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The saved voice if it's still there; otherwise an on-device English voice, preferring the
 * device's default and then the reader's languages.
 */
export function pickVoice<V extends VoiceLike>(
  voices: readonly V[],
  saved: string | undefined,
  languages: readonly string[],
): V | undefined {
  const kept = saved ? voices.find((v) => v.voiceURI === saved) : undefined
  if (kept) return kept
  const local = voices.filter((v) => v.localService && isEnglish(v))
  const wanted = [
    ...languages.map((l) => l.toLowerCase()).filter((l) => l.startsWith('en')),
    'en-us',
  ]
  return (
    local.find((v) => v.default) ??
    wanted.map((l) => local.find((v) => langOf(v) === l)).find(Boolean) ??
    local[0] ??
    voices.find(isEnglish) ??
    voices[0]
  )
}

/** A short name for the voice menu; the language is added when two voices would look alike. */
export function voiceLabels<V extends VoiceLike>(voices: readonly V[]): Map<V, string> {
  const short = (v: V) =>
    v.name
      .replace(/\s+[-–]\s+English.*$/i, '')
      .replace(/\s*\(English \([^)]*\)\)$/i, '')
      .replace(/^Microsoft /, '')
      .trim() || v.name
  const counts = new Map<string, number>()
  voices.forEach((v) => counts.set(short(v), (counts.get(short(v)) ?? 0) + 1))
  return new Map(
    voices.map((v) => [v, (counts.get(short(v)) ?? 0) > 1 ? `${short(v)} (${v.lang})` : short(v)]),
  )
}
