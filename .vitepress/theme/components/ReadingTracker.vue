<script setup lang="ts">
// Watches the reader on written pages: marks the page in progress or done, saves the place,
// resumes it, and publishes where the reader is for the "On this page" ring and ticks. It draws
// nothing itself.
import { useData } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { liveFraction, readHeadings } from '../progress/live.ts'
import {
  DWELL_MS,
  nextStatus,
  readFraction,
  readSections,
  scrollFor,
  shouldResume,
} from '../progress/reading.ts'
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

// Just under whichever header stays on screen: the "On this page" bar below 1280 px, else the nav.
function headerBottom(): number {
  const local = document.querySelector<HTMLElement>('.VPLocalNav')
  const header =
    local && getComputedStyle(local).display !== 'none' ? local : document.querySelector('.VPNav')
  return Math.max(header?.getBoundingClientRect().bottom ?? 0, 0)
}

function updateSections() {
  const headings = [...(content()?.querySelectorAll<HTMLElement>('h2[id], h3[id]') ?? [])].map(
    (h) => ({ id: h.id, level: Number(h.tagName[1]), top: h.getBoundingClientRect().top }),
  )
  const read = readSections(headings, headerBottom() + 24, !fits && fraction >= 0.995)
  const current = readHeadings.value
  if (read.length !== current.size || read.some((id) => !current.has(id))) {
    readHeadings.value = new Set(read)
  }
}

// From 1280 px, a line down the outline's left edge to the end of the last read section.
function paintOutlineLine() {
  const outline = document.querySelector<HTMLElement>('.VPDocAsideOutline .content')
  if (!outline) return
  const links = [...outline.querySelectorAll<HTMLElement>('.outline-link')]
  const lastRead = links.filter((link) => link.parentElement?.classList.contains('read')).at(-1)
  const top = outline.getBoundingClientRect().top
  const from = links[0] ? links[0].getBoundingClientRect().top - top : 0
  const to = lastRead ? lastRead.getBoundingClientRect().bottom - top : from
  outline.style.setProperty('--book-read-from', `${Math.round(from)}px`)
  outline.style.setProperty('--book-read-to', `${Math.round(to)}px`)
}

watch(readHeadings, () => nextTick(paintOutlineLine))

function evaluate() {
  if (!active || pausedPath.value === path) return
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
  updateSections()
  paintOutlineLine()
  evaluate()
  save()
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(measure)
}

function onScroll() {
  if (Date.now() > ignoreScrollUntil) userScrolled = true
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
  readHeadings.value = new Set()
}

// Each call gets a token, so a quick A → B → A trip never runs two at once.
async function enter() {
  const token = ++entry
  clearTimeout(dwellTimer)
  await nextTick()
  if (token !== entry) return
  path = page.value.relativePath
  if (pausedPath.value !== path) pausedPath.value = undefined
  active = frontmatter.value.pageKind === 'written'
  if (!active) return
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
  void resume(token)
}

const onPageHide = () => save(true)

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
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    window.removeEventListener(type, onInput)
  }
})
</script>

<template>
  <span hidden />
</template>
