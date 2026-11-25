<script setup lang="ts">
// Watches the reader on written pages: marks the page in progress or done, saves the place,
// resumes it, and publishes where the reader is for the "On this page" ring and ticks. It draws
// nothing itself.
import { getScrollOffset, useData } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import {
  currentHeadings,
  liveFraction,
  pinnedHeading,
  readHeadings,
  tracking,
} from '../progress/live.ts'
import {
  currentPath,
  DWELL_MS,
  nextStatus,
  readFraction,
  readSections,
  scrollFor,
  shouldResume,
} from '../progress/reading.ts'
import { isJumping, lastLanding } from '../progress/jump.ts'
import { pausedPath, useProgress } from '../progress/useProgress.ts'
import { showToast } from '../toast.ts'

const { page, frontmatter } = useData()
const { store, loaded } = useProgress()

let active = false
let path = ''
let fraction = 0
let fits = false
let startedAt = 0
let dwellReached = false
let userScrolled = false
let ignoreScrollUntil = 0
let lastSave = 0
let entry = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined
let dwellTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0

const SCROLL_KEYS = new Set(['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' ', 'End', 'Home'])

const content = () => document.querySelector<HTMLElement>('.VPDoc .vp-doc')

function geometry() {
  const el = content()
  if (!el) return undefined
  return {
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight,
    contentBottom: el.getBoundingClientRect().bottom + window.scrollY,
  }
}

function updateSections() {
  const headings = [...(content()?.querySelectorAll<HTMLElement>('h2[id], h3[id]') ?? [])].map(
    (h) => ({ id: h.id, level: Number(h.tagName[1]), top: h.getBoundingClientRect().top }),
  )
  // Where VitePress lands a heading (search results, # links, a #hash in the URL), so a
  // heading it jumped to is always the current one.
  const line = getScrollOffset() + 1
  const atEnd = !fits && fraction >= 0.995
  const path = currentPath(headings, line, atEnd, pinnedHeading.value)
  if (path.join() !== currentHeadings.value.join()) currentHeadings.value = path
  const read = readSections(headings, line, atEnd)
  const current = readHeadings.value
  if (read.length !== current.size || read.some((id) => !current.has(id))) {
    readHeadings.value = new Set(read)
  }
}

// After "Reset this page" automatic changes pause, so a page reset at its end isn't marked done
// again on the spot. They resume once the reader has scrolled 10% of the page away from there.
let pausedAt = 0
watch(pausedPath, (paused) => {
  if (paused && paused === path) pausedAt = fraction
})

function evaluate() {
  if (!active) return
  if (pausedPath.value === path) {
    if (Math.abs(fraction - pausedAt) < 0.1) return
    pausedPath.value = undefined
  }
  const elapsed = dwellReached ? Math.max(Date.now() - startedAt, DWELL_MS) : Date.now() - startedAt
  const status = nextStatus({ fraction, fits, elapsed, userScrolled })
  if (status === 'done') store.markDone(path)
  else if (status === 'in-progress') store.markInProgress(path)
}

// At most once a second while scrolling, with a final save when scrolling stops. Only once
// the reader has scrolled: opening a page (or our resume jump) must not overwrite the place.
function save(force = false) {
  if (!active || !userScrolled) return
  clearTimeout(saveTimer)
  const wait = 1000 - (Date.now() - lastSave)
  if (force || wait <= 0) {
    lastSave = Date.now()
    store.setPosition(path, fraction)
  } else {
    saveTimer = setTimeout(() => save(true), wait)
  }
}

function measure() {
  frame = 0
  const g = geometry()
  if (!active || !g) return
  ;({ fraction, fits } = readFraction(g))
  // A page that fits the screen has no "% read" worth showing.
  liveFraction.value = fits ? undefined : fraction
  tracking.value = true
  updateSections()
  evaluate()
  save()
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(measure)
}

function unpin() {
  if (!pinnedHeading.value) return
  pinnedHeading.value = undefined
  schedule()
}

// Back or Forward to another page: the browser already puts the reader back at their place.
let enteredPathname = ''
let fromHistory = false
function onPopState() {
  if (window.location.pathname !== enteredPathname) fromHistory = true
  unpin()
}

function onScroll() {
  if (Date.now() > ignoreScrollUntil) userScrolled = true
  // Scrolled away from a section picked in the outline, by any means (scrollbar, find, …).
  const landed = lastLanding()
  if (pinnedHeading.value && !isJumping() && landed !== undefined) {
    if (Math.abs(window.scrollY - landed) > 4) unpin()
  }
  schedule()
}

// Input the reader gives the page directly always counts, even right after it opens; typing
// in search or scrolling the sidebar or menus doesn't.
const ELSEWHERE =
  'input, textarea, select, [contenteditable], .VPSidebar, .VPNavScreen, .VPLocalSearchBox, .VPLocalNavOutlineDropdown'
function onInput(event: Event) {
  if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return
  if (event.target instanceof Element && event.target.closest(ELSEWHERE)) return
  userScrolled = true
  // A section picked from the outline stays current until the reader scrolls on their own.
  unpin()
}

// Images without a size would move the saved place, so wait for them (up to 3 s).
function imagesReady(): Promise<void> {
  const pending = [...(content()?.querySelectorAll('img') ?? [])].filter(
    (img) => !img.complete && img.loading !== 'lazy',
  )
  const loads = pending.map(
    (img) =>
      new Promise<void>((done) => {
        img.addEventListener('load', () => done(), { once: true })
        img.addEventListener('error', () => done(), { once: true })
      }),
  )
  const timeout = new Promise<void>((done) => setTimeout(done, 3000))
  return Promise.race([Promise.all(loads).then(() => {}), timeout])
}

async function resume(token: number) {
  const saved = store.getPage(path)
  if (!saved || !shouldResume(saved.position, window.location.hash)) return
  await imagesReady()
  const g = geometry()
  if (token !== entry || !g || userScrolled) return
  ignoreScrollUntil = Date.now() + 800
  window.scrollTo({ top: scrollFor(saved.position, g), behavior: 'instant' })
  showToast({
    message: 'Picked up where you left off',
    action: {
      label: 'Back to top',
      run: () => {
        ignoreScrollUntil = Date.now() + 800
        window.scrollTo({ top: 0, behavior: 'instant' })
      },
    },
  })
}

function leave() {
  if (active) save(true)
  clearTimeout(dwellTimer)
  clearTimeout(saveTimer)
  active = false
  liveFraction.value = undefined
  pinnedHeading.value = undefined
  currentHeadings.value = []
  readHeadings.value = new Set()
}

// Each call gets a token, so a quick A → B → A trip never runs two at once.
async function enter() {
  const token = ++entry
  clearTimeout(dwellTimer)
  await nextTick()
  if (token !== entry) return
  path = page.value.relativePath
  enteredPathname = window.location.pathname
  const restored = fromHistory
  fromHistory = false
  if (pausedPath.value !== path) pausedPath.value = undefined
  active = frontmatter.value.pageKind === 'written'
  // Left on between written pages, so the outline doesn't flash its plain look.
  if (!active) {
    tracking.value = false
    return
  }
  startedAt = Date.now()
  dwellReached = false
  userScrolled = false
  // VitePress scrolls a newly opened page to the top; that isn't the reader.
  ignoreScrollUntil = Date.now() + 800
  lastSave = 0
  store.visit(path)
  dwellTimer = setTimeout(() => {
    dwellReached = true
    measure()
  }, DWELL_MS)
  measure()
  if (!restored) void resume(token)
}

const onPageHide = () => save(true)

watch(pinnedHeading, () => schedule())

// Save the page being left before the new one renders.
watch(
  () => page.value.relativePath,
  () => {
    leave()
    if (loaded.value) void enter()
  },
)
watch(loaded, (ready) => ready && void enter(), { immediate: true })

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('pagehide', onPageHide)
  // Back/forward and in-page # links move the page without a scroll gesture of the reader's.
  window.addEventListener('popstate', onPopState)
  window.addEventListener('hashchange', unpin)
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    window.addEventListener(type, onInput, { passive: true })
  }
})

onBeforeUnmount(() => {
  leave()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', schedule)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('hashchange', unpin)
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    window.removeEventListener(type, onInput)
  }
})
</script>

<template>
  <span hidden />
</template>
