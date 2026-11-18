import { describe, expect, it, vi } from 'vitest'
import type { CatalogSection } from '../.vitepress/lib/catalog.ts'
import {
  BACKUP_KEY,
  PROGRESS_KEY,
  browserStorage,
  createProgressStore,
  parseProgress,
  type StorageLike,
} from '../.vitepress/theme/progress/store.ts'

const page = (path: string, kind: 'written' | 'soon', quiz?: string) => ({
  path,
  link: '/' + path,
  label: path,
  title: path,
  kind,
  section: path.split('/')[0] ?? '',
  quiz,
})

const catalog: CatalogSection[] = [
  {
    id: 'learn',
    title: 'Learn',
    nav: 'Learn',
    overviewLink: '/learn/',
    overviewPath: 'learn/index.md',
    pages: [
      page('learn/a.md', 'written'),
      page('learn/b.md', 'written'),
      page('learn/c.md', 'soon'),
    ],
  },
  {
    id: 'designs',
    title: 'Designs',
    nav: 'Designs',
    overviewLink: '/designs/',
    overviewPath: 'designs/index.md',
    pages: [
      page('designs/x/design.md', 'written', 'designs/x/quiz.md'),
      page('designs/y/design.md', 'soon'),
    ],
  },
]

const A = 'learn/a.md'
const B = 'learn/b.md'
const DESIGN = 'designs/x/design.md'
const QUIZ = 'designs/x/quiz.md'

/** A Map-backed localStorage; `fail` makes the named method throw. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const fail = new Set<'getItem' | 'setItem'>()
  const storage: StorageLike = {
    getItem: (key) => {
      if (fail.has('getItem')) throw new Error('blocked')
      return map.get(key) ?? null
    },
    setItem: (key, value) => {
      if (fail.has('setItem')) throw new Error('quota')
      map.set(key, value)
    },
    removeItem: (key) => void map.delete(key),
  }
  const saved = () => JSON.parse(map.get(PROGRESS_KEY) ?? 'null')
  return { storage, map, fail, saved }
}

let clock = 0
const now = () => new Date(Date.UTC(2026, 10, 18, 10, 0, clock++))

function setup(initial?: Record<string, string>) {
  const fake = fakeStorage(initial)
  const store = createProgressStore({ catalog, storage: () => fake.storage, now })
  store.load()
  return { ...fake, store }
}

describe('loading', () => {
  it('is unknown until loaded, then stored and empty', () => {
    const fake = fakeStorage()
    const store = createProgressStore({ catalog, storage: () => fake.storage, now })
    expect(store.mode).toEqual({ kind: 'unknown' })
    store.load()
    expect(store.mode).toEqual({ kind: 'stored' })
    expect(store.getPage(A)).toBeUndefined()
    expect(store.summary().done).toBe(0)
  })

  it('reads what an earlier visit saved', () => {
    const first = setup()
    first.store.markDone(A)
    const second = createProgressStore({ catalog, storage: () => first.storage, now })
    second.load()
    expect(second.getPage(A)?.status).toBe('done')
  })
})

describe('reading progress', () => {
  it('starts a page, saves its place and marks it done, keeping the place', () => {
    const { store, saved } = setup()
    store.markInProgress(A)
    store.setPosition(A, 0.42)
    expect(store.getPage(A)).toMatchObject({ status: 'in-progress', position: 0.42 })
    store.markDone(A)
    expect(saved().pages[A]).toMatchObject({ status: 'done', position: 0.42 })
  })

  it('ignores a position for a page that has not started, and clamps it to 0–1', () => {
    const { store } = setup()
    store.setPosition(A, 0.5)
    expect(store.getPage(A)).toBeUndefined()
    store.markInProgress(A)
    store.setPosition(A, 3)
    expect(store.getPage(A)?.position).toBe(1)
    store.setPosition(A, -1)
    expect(store.getPage(A)?.position).toBe(0)
    store.setPosition(A, Number.NaN)
    expect(store.getPage(A)?.position).toBe(0)
  })

  it('never turns a done page back to in progress', () => {
    const { store } = setup()
    store.markDone(A)
    store.markInProgress(A)
    expect(store.getPage(A)?.status).toBe('done')
  })

  it('remembers the last page opened', () => {
    const { store, saved } = setup()
    store.visit(DESIGN)
    expect(store.lastPage()).toBe(DESIGN)
    expect(saved().lastPage).toBe(DESIGN)
  })

  it('re-reads before each change, so another tab’s progress is kept', () => {
    const tabA = setup()
    const tabB = createProgressStore({ catalog, storage: () => tabA.storage, now })
    tabB.load()
    tabA.store.markDone(A)
    tabB.markInProgress(B)
    expect(tabA.saved().pages).toMatchObject({
      [A]: { status: 'done' },
      [B]: { status: 'in-progress' },
    })
  })
})

describe('quizzes', () => {
  it('keeps the last and best scores and counts attempts', () => {
    const { store } = setup()
    store.recordQuiz(QUIZ, 12, 20)
    store.recordQuiz(QUIZ, 17, 20)
    store.recordQuiz(QUIZ, 9, 20)
    expect(store.getQuiz(QUIZ)).toMatchObject({
      last: { score: 9, total: 20 },
      best: { score: 17, total: 20 },
      attempts: 3,
    })
  })

  it('compares best scores as fractions when the question count changes', () => {
    const { store } = setup()
    store.recordQuiz(QUIZ, 15, 20)
    store.recordQuiz(QUIZ, 17, 22)
    expect(store.getQuiz(QUIZ)?.best).toMatchObject({ score: 17, total: 22 })
  })

  it('rejects impossible scores', () => {
    const { store } = setup()
    expect(() => store.recordQuiz(QUIZ, 21, 20)).toThrow(RangeError)
    expect(() => store.recordQuiz(QUIZ, 1, 0)).toThrow(RangeError)
    expect(() => store.recordQuiz(QUIZ, 1.5, 20)).toThrow(RangeError)
  })

  it('resets one quiz', () => {
    const { store } = setup()
    store.recordQuiz(QUIZ, 10, 20)
    store.resetQuiz(QUIZ)
    expect(store.getQuiz(QUIZ)).toBeUndefined()
  })
})

describe('resetting', () => {
  it('clears a design page and its quiz, and undo puts both back exactly', () => {
    const { store, saved } = setup()
    store.markInProgress(DESIGN)
    store.setPosition(DESIGN, 0.6)
    store.recordQuiz(QUIZ, 14, 20)
    const before = structuredClone(saved())
    const snapshot = store.resetPage(DESIGN)
    expect(store.getPage(DESIGN)).toBeUndefined()
    expect(store.getQuiz(QUIZ)).toBeUndefined()
    store.restore(snapshot)
    expect(saved()).toEqual(before)
  })

  it('leaves other pages alone when resetting one', () => {
    const { store } = setup()
    store.markDone(A)
    store.markDone(B)
    store.resetPage(A)
    expect(store.getPage(B)?.status).toBe('done')
  })

  it('clears all progress, scores and the last page, but no other keys', () => {
    const settings = '{"voiceURI":"x","rate":1.2}'
    const { store, saved, map } = setup({ 'sdi:settings:v1': settings, 'sdi:text-size:v1': '1.25' })
    store.markDone(A)
    store.recordQuiz(QUIZ, 10, 20)
    store.visit(A)
    store.resetAll()
    expect(saved()).toEqual({ version: 1, pages: {}, quizzes: {} })
    expect(map.get('sdi:settings:v1')).toBe(settings)
    expect(map.get('sdi:text-size:v1')).toBe('1.25')
  })
})

describe('summary', () => {
  it('counts written pages only, per section and overall', () => {
    const { store } = setup()
    store.markDone(A)
    store.markInProgress(B)
    store.markDone(DESIGN)
    store.markDone('learn/c.md') // a coming-soon page never counts
    expect(store.summary()).toEqual({
      done: 2,
      inProgress: 1,
      total: 3,
      sections: [
        { id: 'learn', done: 1, inProgress: 1, total: 2 },
        { id: 'designs', done: 1, inProgress: 0, total: 1 },
      ],
    })
  })
})

describe('when storage misbehaves', () => {
  it('works in memory when storage is blocked', () => {
    const store = createProgressStore({ catalog, storage: () => null, now })
    store.load()
    expect(store.mode).toEqual({ kind: 'memory', reason: 'blocked' })
    store.markDone(A)
    expect(store.getPage(A)?.status).toBe('done')
  })

  it('treats a storage that throws on reading as blocked', () => {
    const fake = fakeStorage()
    fake.fail.add('getItem')
    const store = createProgressStore({ catalog, storage: () => fake.storage, now })
    store.load()
    expect(store.mode).toEqual({ kind: 'memory', reason: 'blocked' })
  })

  it('keeps a change in memory when saving fails, and stops saving', () => {
    const { store, fail, saved } = setup()
    store.markDone(A)
    fail.add('setItem')
    store.markDone(B)
    expect(store.mode).toEqual({ kind: 'memory', reason: 'blocked' })
    expect(store.getPage(B)?.status).toBe('done')
    fail.delete('setItem')
    expect(saved().pages[B]).toBeUndefined()
  })

  it('never overwrites data saved by a newer version', () => {
    const newer = JSON.stringify({ version: 2, everything: 'different' })
    const { store, map } = setup({ [PROGRESS_KEY]: newer })
    expect(store.mode).toEqual({ kind: 'memory', reason: 'newer' })
    store.markDone(A)
    expect(store.getPage(A)?.status).toBe('done')
    expect(map.get(PROGRESS_KEY)).toBe(newer)
  })

  it('backs up data it cannot read, then starts again', () => {
    const { store, map, saved } = setup({ [PROGRESS_KEY]: '{not json' })
    expect(store.mode).toEqual({ kind: 'stored' })
    expect(map.get(BACKUP_KEY)).toBe('{not json')
    expect(saved()).toEqual({ version: 1, pages: {}, quizzes: {} })
  })

  it('finds no storage outside a browser', () => {
    expect(browserStorage()).toBeNull()
  })
})

describe('parseProgress', () => {
  it('drops unreadable entries and keeps the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      pages: {
        [A]: { status: 'done', position: 1.7, updatedAt: 't' },
        [B]: { status: 'finished', position: 0.5, updatedAt: 't' },
        x: 'nonsense',
      },
      quizzes: {
        [QUIZ]: {
          last: { score: 3, total: 20, at: 't' },
          best: { score: 3, total: 20, at: 't' },
          attempts: 1,
        },
        'bad.md': { last: { score: 30, total: 20, at: 't' }, best: {}, attempts: 1 },
      },
      lastPage: A,
    })
    const parsed = parseProgress(raw)
    expect(parsed.kind).toBe('ok')
    if (parsed.kind !== 'ok') return
    expect(Object.keys(parsed.data.pages)).toEqual([A])
    expect(parsed.data.pages[A]?.position).toBe(1)
    expect(Object.keys(parsed.data.quizzes)).toEqual([QUIZ])
    expect(parsed.data.lastPage).toBe(A)
  })

  it('tells empty, newer and broken values apart', () => {
    expect(parseProgress(null)).toEqual({
      kind: 'ok',
      data: { version: 1, pages: {}, quizzes: {} },
    })
    expect(parseProgress('{"version":2}').kind).toBe('newer')
    for (const bad of [
      '[]',
      '"x"',
      '{}',
      '{"version":1}',
      '{"version":0,"pages":{},"quizzes":{}}',
    ]) {
      expect(parseProgress(bad).kind).toBe('bad')
    }
  })
})

describe('subscribe', () => {
  it('tells listeners about loads and real changes only', () => {
    const fake = fakeStorage()
    const store = createProgressStore({ catalog, storage: () => fake.storage, now })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.load()
    store.markDone(A)
    store.markDone(A) // no change
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    store.markDone(B)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('edge cases', () => {
  it('ignores changes before load, so nothing gets stuck in memory', () => {
    const fake = fakeStorage()
    const store = createProgressStore({ catalog, storage: () => fake.storage, now })
    store.markDone(A)
    store.load()
    expect(store.mode).toEqual({ kind: 'stored' })
    expect(store.getPage(A)).toBeUndefined()
  })

  it('loads only once, so changes kept in memory survive a second call', () => {
    const store = createProgressStore({ catalog, storage: () => null, now })
    store.load()
    store.markDone(A)
    store.load()
    expect(store.getPage(A)?.status).toBe('done')
  })

  it('treats "__proto__" in saved data as a plain key and drops it', () => {
    const raw = JSON.stringify({
      version: 1,
      pages: JSON.parse('{"__proto__":{"status":"done","position":0,"updatedAt":"t"}}'),
      quizzes: {},
    })
    const { store } = setup({ [PROGRESS_KEY]: raw })
    expect(store.getPage('status')).toBeUndefined()
    expect(store.getPage('__proto__')).toBeUndefined()
    store.markDone(A)
    expect(store.getPage(A)?.status).toBe('done')
  })

  it('keeps fields a later build added under the same version', () => {
    const raw = JSON.stringify({
      version: 1,
      pages: { [A]: { status: 'done', position: 1, updatedAt: 't', notes: 'kept' } },
      quizzes: {},
      bookmarks: ['kept'],
    })
    const { store, saved } = setup({ [PROGRESS_KEY]: raw })
    store.markInProgress(B)
    expect(saved().bookmarks).toEqual(['kept'])
    expect(saved().pages[A].notes).toBe('kept')
  })

  it('stops saving when another tab saves newer-version data mid-visit', () => {
    const { store, map } = setup()
    store.markDone(A)
    const newer = JSON.stringify({ version: 2 })
    map.set(PROGRESS_KEY, newer)
    store.markDone(B)
    expect(store.mode).toEqual({ kind: 'memory', reason: 'newer' })
    expect(store.getPage(B)?.status).toBe('done')
    expect(map.get(PROGRESS_KEY)).toBe(newer)
  })

  it('goes memory-only when the backup of unreadable data cannot be written', () => {
    const fake = fakeStorage({ [PROGRESS_KEY]: '{not json' })
    fake.fail.add('setItem')
    const store = createProgressStore({ catalog, storage: () => fake.storage, now })
    store.load()
    expect(store.mode).toEqual({ kind: 'memory', reason: 'blocked' })
    expect(fake.map.get(PROGRESS_KEY)).toBe('{not json')
  })

  it('keeps an older backup rather than overwriting it', () => {
    const { map } = setup({ [PROGRESS_KEY]: '{bad', [BACKUP_KEY]: '{first bad' })
    expect(map.get(BACKUP_KEY)).toBe('{first bad')
  })

  it('undo never overwrites what was saved after the reset', () => {
    const { store } = setup()
    store.markDone(DESIGN)
    store.recordQuiz(QUIZ, 8, 20)
    const snapshot = store.resetPage(DESIGN)
    store.recordQuiz(QUIZ, 19, 20)
    store.restore(snapshot)
    expect(store.getPage(DESIGN)?.status).toBe('done')
    expect(store.getQuiz(QUIZ)?.last.score).toBe(19)
    expect(store.getQuiz(QUIZ)?.attempts).toBe(1)
  })

  it('saves the place on a done page and keeps it done', () => {
    const { store } = setup()
    store.markDone(A)
    store.setPosition(A, 0.3)
    expect(store.getPage(A)).toMatchObject({ status: 'done', position: 0.3 })
  })

  it('hands out frozen copies, not its own data', () => {
    const { store } = setup()
    store.markDone(A)
    const copy = store.getPage(A) as { status: string }
    expect(() => {
      copy.status = 'in-progress'
    }).toThrow(TypeError)
    expect(store.getPage(A)?.status).toBe('done')
  })

  it('undo brings the place back even if the page was started again after the reset', () => {
    const { store } = setup()
    store.markInProgress(A)
    store.setPosition(A, 0.7)
    const snapshot = store.resetPage(A)
    store.markInProgress(A)
    store.restore(snapshot)
    expect(store.getPage(A)).toMatchObject({ status: 'in-progress', position: 0.7 })
  })

  it('undo keeps progress made since the reset when it is further along', () => {
    const { store } = setup()
    store.markInProgress(A)
    store.setPosition(A, 0.2)
    const snapshot = store.resetPage(A)
    store.markDone(A)
    store.restore(snapshot)
    expect(store.getPage(A)?.status).toBe('done')
  })

  it('keeps unknown fields through markDone and recordQuiz', () => {
    const raw = JSON.stringify({
      version: 1,
      pages: { [A]: { status: 'in-progress', position: 0.5, updatedAt: 't', notes: 'kept' } },
      quizzes: {
        [QUIZ]: {
          last: { score: 1, total: 2, at: 't' },
          best: { score: 1, total: 2, at: 't' },
          attempts: 1,
          hint: 'kept',
        },
      },
    })
    const { store, saved } = setup({ [PROGRESS_KEY]: raw })
    store.markDone(A)
    store.recordQuiz(QUIZ, 2, 2)
    expect(saved().pages[A].notes).toBe('kept')
    expect(saved().quizzes[QUIZ].hint).toBe('kept')
  })

  it('after resetting everything, odd page paths still work', () => {
    const store = createProgressStore({ catalog, storage: () => null, now })
    store.load()
    store.resetAll()
    store.markInProgress('toString')
    expect(store.getPage('toString')?.status).toBe('in-progress')
  })
})
