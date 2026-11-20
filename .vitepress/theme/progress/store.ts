// All reading progress and quiz scores saved on this device. Plain TypeScript: the Vue
// wrapper comes with the UI that uses it. Settings (voice, speed, text size) live in other
// keys, so nothing here touches them.
import type { CatalogSection } from '../../lib/catalog.ts'

export const PROGRESS_KEY = 'sdi:progress:v1'
export const BACKUP_KEY = 'sdi:progress:backup'
const VERSION = 1

export type PageStatus = 'in-progress' | 'done'

export interface PageProgress {
  status: PageStatus
  /** How far down the page the reader was, 0–1. */
  position: number
  updatedAt: string
}

export interface QuizScore {
  score: number
  total: number
  at: string
}

export interface QuizProgress {
  last: QuizScore
  best: QuizScore
  attempts: number
}

export interface ProgressData {
  version: typeof VERSION
  pages: Record<string, PageProgress>
  quizzes: Record<string, QuizProgress>
  lastPage?: string
}

/**
 * `unknown` until `load()` runs in the browser. `memory`: nothing is saved, either because
 * storage is blocked or because another version of the site saved data we mustn't overwrite.
 */
export type StoreMode =
  { kind: 'unknown' } | { kind: 'stored' } | { kind: 'memory'; reason: 'blocked' | 'newer' }

/** What `resetPage` removed, so "Undo" can put it back exactly. */
export interface ResetSnapshot {
  path: string
  page?: PageProgress
  quizPath?: string
  quiz?: QuizProgress
}

export interface ProgressCount {
  done: number
  inProgress: number
  total: number
}

export interface ProgressSummary extends ProgressCount {
  sections: Array<ProgressCount & { id: string }>
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface StoreOptions {
  catalog: CatalogSection[]
  /** Returns usable storage, or null when it's blocked. Defaults to `window.localStorage`. */
  storage?: () => StorageLike | null
  now?: () => Date
}

// Prototype-free maps, so a saved key like "__proto__" is just a key.
const map = <T>(): Record<string, T> => Object.create(null) as Record<string, T>
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const empty = (): ProgressData => ({ version: VERSION, pages: map(), quizzes: map() })

/** localStorage, or null when it's missing or blocked (Firefox throws just reading it). */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage
    const probe = 'sdi:probe'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

type Parsed = { kind: 'ok'; data: ProgressData } | { kind: 'newer' } | { kind: 'bad' }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

function readScore(value: unknown): QuizScore | undefined {
  if (!isObject(value)) return undefined
  const { score, total, at } = value
  if (!isCount(score) || !isCount(total) || total === 0 || score > total) return undefined
  return typeof at === 'string' ? { ...value, score, total, at } : undefined
}

function readPage(value: unknown): PageProgress | undefined {
  if (!isObject(value)) return undefined
  const { status, position, updatedAt } = value
  if (status !== 'in-progress' && status !== 'done') return undefined
  if (typeof position !== 'number' || !Number.isFinite(position)) return undefined
  if (typeof updatedAt !== 'string') return undefined
  // Fields a later build may add under the same version are kept, not stripped.
  return { ...value, status, position: clamp(position), updatedAt }
}

function readQuiz(value: unknown): QuizProgress | undefined {
  if (!isObject(value)) return undefined
  const last = readScore(value.last)
  const best = readScore(value.best)
  if (!last || !best || !isCount(value.attempts) || value.attempts === 0) return undefined
  return { ...value, last, best, attempts: value.attempts }
}

/** Reads the saved value. One unreadable entry is dropped; anything worse is `bad`. */
export function parseProgress(raw: string | null): Parsed {
  if (raw === null) return { kind: 'ok', data: empty() }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { kind: 'bad' }
  }
  if (!isObject(value)) return { kind: 'bad' }
  if (typeof value.version === 'number' && value.version > VERSION) return { kind: 'newer' }
  if (value.version !== VERSION || !isObject(value.pages) || !isObject(value.quizzes)) {
    return { kind: 'bad' }
  }
  const data: ProgressData = { ...value, ...empty() }
  delete data.lastPage
  for (const [path, entry] of Object.entries(value.pages)) {
    const page = readPage(entry)
    if (page && !UNSAFE_KEYS.has(path)) data.pages[path] = page
  }
  for (const [path, entry] of Object.entries(value.quizzes)) {
    const quiz = readQuiz(entry)
    if (quiz && !UNSAFE_KEYS.has(path)) data.quizzes[path] = quiz
  }
  if (typeof value.lastPage === 'string') data.lastPage = value.lastPage
  return { kind: 'ok', data }
}

const clamp = (n: number): number => Math.min(Math.max(n, 0), 1)

/** True when `page` shows more reading than `other`: done beats in progress, then position. */
const isAhead = (page: PageProgress, other: PageProgress | undefined): boolean =>
  !other ||
  (page.status === 'done' && other.status !== 'done') ||
  (page.status === other.status && page.position > other.position)

const frozen = <T extends object>(value: T | undefined): T | undefined =>
  value && Object.freeze(structuredClone(value))

export function createProgressStore({
  catalog,
  storage: getStorage = browserStorage,
  now = () => new Date(),
}: StoreOptions) {
  let mode: StoreMode = { kind: 'unknown' }
  let data = empty()
  let storage: StorageLike | null = null
  const listeners = new Set<() => void>()
  const quizOf = new Map<string, string>(
    catalog.flatMap((section) =>
      section.pages.flatMap((page): Array<[string, string]> =>
        page.quiz ? [[page.path, page.quiz]] : [],
      ),
    ),
  )

  const notify = () => listeners.forEach((listener) => listener())
  const stamp = () => now().toISOString()

  // Reads what's saved right now; another tab may have written since we last looked.
  function readSaved(): ProgressData | 'newer' | 'blocked' {
    if (!storage) return 'blocked'
    let raw: string | null
    try {
      raw = storage.getItem(PROGRESS_KEY)
    } catch {
      return 'blocked'
    }
    const parsed = parseProgress(raw)
    if (parsed.kind === 'newer') return 'newer'
    if (parsed.kind === 'ok') return parsed.data
    // Unreadable: keep a copy for whoever wants to dig it out, then start again. An older
    // backup is kept rather than overwritten.
    try {
      if (raw !== null && storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, raw)
      storage.setItem(PROGRESS_KEY, JSON.stringify(empty()))
    } catch {
      return 'blocked'
    }
    return empty()
  }

  /** Runs once; a second call would throw away changes that only live in memory. */
  function load() {
    if (mode.kind !== 'unknown') return
    storage = getStorage()
    const saved = readSaved()
    if (saved === 'blocked' || saved === 'newer') {
      mode = { kind: 'memory', reason: saved }
      data = empty()
    } else {
      mode = { kind: 'stored' }
      data = saved
    }
    notify()
  }

  /**
   * Applies one change to the freshest data and saves it. `change` returns false for no-ops.
   * Before `load()` (server rendering, first render) changes are ignored.
   */
  function update(change: (current: ProgressData) => boolean) {
    if (mode.kind === 'unknown') return
    if (mode.kind === 'stored') {
      const saved = readSaved()
      if (saved === 'blocked' || saved === 'newer') mode = { kind: 'memory', reason: saved }
      else data = saved
    }
    if (!change(data)) return
    if (mode.kind === 'stored') {
      try {
        storage?.setItem(PROGRESS_KEY, JSON.stringify(data))
      } catch {
        mode = { kind: 'memory', reason: 'blocked' }
      }
    }
    notify()
  }

  return {
    get mode(): StoreMode {
      return mode
    },
    load,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // Copies, so a caller can't change the store's data behind its back.
    getPage: (path: string): Readonly<PageProgress> | undefined => frozen(data.pages[path]),
    getQuiz: (quizPath: string): Readonly<QuizProgress> | undefined =>
      frozen(data.quizzes[quizPath]),
    lastPage: (): string | undefined => data.lastPage,

    visit(path: string) {
      update((d) => {
        if (d.lastPage === path) return false
        d.lastPage = path
        return true
      })
    },

    markInProgress(path: string) {
      update((d) => {
        if (d.pages[path]) return false
        d.pages[path] = { status: 'in-progress', position: 0, updatedAt: stamp() }
        return true
      })
    },

    markDone(path: string) {
      update((d) => {
        const page = d.pages[path]
        if (page?.status === 'done') return false
        d.pages[path] = {
          ...page,
          status: 'done',
          position: page?.position ?? 0,
          updatedAt: stamp(),
        }
        return true
      })
    },

    setPosition(path: string, position: number) {
      if (!Number.isFinite(position)) return
      update((d) => {
        const page = d.pages[path]
        const value = clamp(position)
        if (!page || page.position === value) return false
        d.pages[path] = { ...page, position: value, updatedAt: stamp() }
        return true
      })
    },

    /** Clears the page and its design's quiz. The snapshot undoes it. */
    resetPage(path: string): ResetSnapshot {
      const quizPath = quizOf.get(path)
      const snapshot: ResetSnapshot = { path, quizPath }
      update((d) => {
        snapshot.page = d.pages[path]
        snapshot.quiz = quizPath ? d.quizzes[quizPath] : undefined
        if (!snapshot.page && !snapshot.quiz) return false
        delete d.pages[path]
        if (quizPath) delete d.quizzes[quizPath]
        return true
      })
      return snapshot
    },

    /**
     * Undoes `resetPage`. The page comes back unless what's saved now is further along; a
     * quiz attempt made since the reset is kept.
     */
    restore(snapshot: ResetSnapshot) {
      update((d) => {
        let changed = false
        if (snapshot.page && isAhead(snapshot.page, d.pages[snapshot.path])) {
          d.pages[snapshot.path] = snapshot.page
          changed = true
        }
        const { quizPath, quiz } = snapshot
        if (quizPath && quiz && !d.quizzes[quizPath]) {
          d.quizzes[quizPath] = quiz
          changed = true
        }
        return changed
      })
    },

    recordQuiz(quizPath: string, score: number, total: number) {
      if (!isCount(score) || !isCount(total) || total === 0 || score > total) {
        throw new RangeError(`Bad quiz score ${score} / ${total}`)
      }
      update((d) => {
        const previous = d.quizzes[quizPath]
        const last = { score, total, at: stamp() }
        const better = !previous || score / total > previous.best.score / previous.best.total
        d.quizzes[quizPath] = {
          ...previous,
          last,
          best: better ? last : previous.best,
          attempts: (previous?.attempts ?? 0) + 1,
        }
        return true
      })
    },

    /** Clears one quiz score and returns what was saved, so "Undo" can put it back. */
    resetQuiz(quizPath: string): QuizProgress | undefined {
      let removed: QuizProgress | undefined
      update((d) => {
        removed = d.quizzes[quizPath]
        if (!removed) return false
        delete d.quizzes[quizPath]
        return true
      })
      return removed
    },

    /** Clears all reading progress and quiz scores. Settings are in other keys and stay. */
    resetAll() {
      update((d) => {
        d.pages = map()
        d.quizzes = map()
        delete d.lastPage
        return true
      })
    },

    /** Done and in-progress counts per section and overall, over written pages only. */
    summary(): ProgressSummary {
      const sections = catalog.map((section) => {
        const tracked = section.pages.filter((page) => page.kind === 'written')
        const status = tracked.map((page) => data.pages[page.path]?.status)
        return {
          id: section.id,
          done: status.filter((s) => s === 'done').length,
          inProgress: status.filter((s) => s === 'in-progress').length,
          total: tracked.length,
        }
      })
      const sum = (key: keyof ProgressCount) => sections.reduce((n, s) => n + s[key], 0)
      return { sections, done: sum('done'), inProgress: sum('inProgress'), total: sum('total') }
    },
  }
}

export type ProgressStore = ReturnType<typeof createProgressStore>
