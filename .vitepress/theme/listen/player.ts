// The listening player's state, shared by the "Listen" button and the player bar.
// One utterance per sentence, queued a block at a time; pausing cancels and playing restarts
// the sentence, since pause() and resume() misbehave on some phones.
import { computed, ref, shallowRef } from 'vue'
import { stickyHeaderBottom } from '../progress/jump.ts'
import { collectBlocks, rangeOf, type Block } from './blocks.ts'
import { LISTEN_KEY, bookVoices, parseSettings, pickVoice } from './voices.ts'

const HIGHLIGHT = 'listen-sentence'
// How long the player waits for the device to list its voices before saying there are none.
const VOICE_WAIT_MS = 1500
// After the reader scrolls, the player stops following for this long.
const FOLLOW_PAUSE_MS = 5000

export const supported = ref(false)
export const open = ref(false)
export const playing = ref(false)
export const ended = ref(false)
export const problem = ref<string>()
export const blocks = shallowRef<Block[]>([])
export const index = ref(0)
export const part = ref(0)
export const speed = ref(1)
export const voices = shallowRef<SpeechSynthesisVoice[]>([])
export const voicesReady = ref(false)
const savedVoice = ref<string>()

export const voice = computed(() =>
  pickVoice(
    voices.value,
    savedVoice.value,
    typeof navigator === 'undefined' ? [] : navigator.languages,
  ),
)
export const block = computed(() => blocks.value[index.value])
export const sentence = computed(() => {
  const current = block.value
  const range = current?.parts[part.value]
  return current && range ? current.text.slice(...range) : ''
})

let generation = 0
let queued: SpeechSynthesisUtterance[] = []
let lastUserScroll = 0
// True while the player waits for the device to list its voices.
export const loadingVoices = ref(false)

/** Feature check, voices and saved settings; call from onMounted. */
export function initListening() {
  if (supported.value || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  supported.value = true
  // Chrome keeps talking across a reload.
  speechSynthesis.cancel()
  try {
    const saved = parseSettings(localStorage.getItem(LISTEN_KEY))
    speed.value = saved.speed
    savedVoice.value = saved.voice
  } catch {
    // Storage blocked: defaults until the page is closed.
  }
  const update = () => {
    voices.value = bookVoices(speechSynthesis.getVoices())
    if (voices.value.length === 0) return
    // Voices that turn up after the wait: Play works again.
    if (problem.value === NO_VOICES) problem.value = undefined
    settle()
  }
  const settle = () => {
    if (voicesReady.value) return
    voicesReady.value = true
    if (loadingVoices.value) {
      loadingVoices.value = false
      if (voices.value.length > 0) speakFrom(index.value, 0)
      else showNoVoices()
    }
  }
  if ('addEventListener' in speechSynthesis) {
    speechSynthesis.addEventListener('voiceschanged', update)
  } else {
    ;(speechSynthesis as SpeechSynthesis).onvoiceschanged = update
  }
  update()
  setTimeout(settle, VOICE_WAIT_MS)
  // pause() rather than cancel(), so a cancelled utterance's `end` can't start the next one.
  window.addEventListener('pagehide', pause)
}

function save() {
  try {
    localStorage.setItem(
      LISTEN_KEY,
      JSON.stringify({ speed: speed.value, voice: savedVoice.value }),
    )
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
}

export function setSpeed(value: number) {
  speed.value = value
  save()
  if (playing.value) speakFrom(index.value, part.value)
}

export function setVoice(uri: string) {
  savedVoice.value = uri
  save()
  problem.value = undefined
  if (playing.value) speakFrom(index.value, part.value)
}

const NO_VOICES = 'No voices available on this device'

function showNoVoices() {
  problem.value = NO_VOICES
  playing.value = false
}

/** Opens the player and reads from the first block on screen. */
export function start() {
  const root = document.querySelector<HTMLElement>('.vp-doc')
  if (!root || !supported.value) return
  blocks.value = collectBlocks(root)
  if (blocks.value.length === 0) return
  const top = stickyHeaderBottom()
  const first = blocks.value.findIndex((b) => b.el.getBoundingClientRect().bottom > top)
  index.value = Math.max(first, 0)
  part.value = 0
  ended.value = false
  problem.value = undefined
  open.value = true
  addFollowListeners()
  if (voices.value.length > 0) speakFrom(index.value, 0)
  else if (voicesReady.value) showNoVoices()
  else {
    loadingVoices.value = true
    // iOS only lets speech start inside a tap; a silent utterance now allows it later.
    const unlock = new SpeechSynthesisUtterance(' ')
    unlock.volume = 0
    speechSynthesis.speak(unlock)
  }
  highlight()
}

export function play() {
  if (ended.value) {
    ended.value = false
    speakFrom(0, 0)
  } else {
    speakFrom(index.value, part.value)
  }
}

export function pause() {
  if (!supported.value) return
  generation++
  speechSynthesis.cancel()
  playing.value = false
}

export function next() {
  move(index.value + 1)
}

export function previous() {
  move(index.value - 1)
}

function move(to: number) {
  if (to < 0 || to >= blocks.value.length) return
  ended.value = false
  if (playing.value) {
    speakFrom(to, 0)
  } else {
    index.value = to
    part.value = 0
    highlight()
    follow(true)
  }
}

/** Stops reading and closes the player. */
export function close() {
  generation++
  loadingVoices.value = false
  if (supported.value) speechSynthesis.cancel()
  open.value = false
  playing.value = false
  ended.value = false
  problem.value = undefined
  clearHighlight()
  blocks.value = []
  queued = []
  removeFollowListeners()
}

function speakFrom(at: number, from: number) {
  const gen = ++generation
  speechSynthesis.cancel()
  const current = blocks.value[at]
  if (!current) {
    finish()
    return
  }
  index.value = at
  part.value = from
  problem.value = undefined
  highlight()
  follow(false)
  const chosen = voice.value
  const ranges = current.parts.slice(from)
  queued = ranges.map((range, k) => {
    const utterance = new SpeechSynthesisUtterance(current.text.slice(...range))
    utterance.rate = speed.value
    utterance.lang = chosen?.lang ?? 'en-US'
    if (chosen) utterance.voice = chosen
    utterance.onstart = () => {
      if (gen !== generation) return
      part.value = from + k
      highlight()
    }
    utterance.onend = () => {
      if (gen !== generation) return
      if (k === ranges.length - 1) speakFrom(at + 1, 0)
      else {
        // Some browsers never send `start`, so move the highlight on here too.
        part.value = from + k + 1
        highlight()
      }
    }
    utterance.onerror = (event) => {
      if (gen !== generation) return
      generation++
      speechSynthesis.cancel()
      playing.value = false
      // Our own cancels change the generation first, so this one came from the browser or system.
      if (event.error === 'interrupted' || event.error === 'canceled') return
      problem.value =
        event.error === 'network'
          ? 'This voice needs internet. Choose one on this device.'
          : "Couldn't read this with this voice. Try another one."
    }
    return utterance
  })
  queued.forEach((u) => speechSynthesis.speak(u))
  playing.value = true
}

function finish() {
  playing.value = false
  ended.value = true
  index.value = Math.max(blocks.value.length - 1, 0)
  part.value = 0
  clearHighlight()
}

/** Marks the sentence being read; ListenGlide.vue draws the box behind the block. */
function highlight() {
  const current = block.value
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
  const range = current && !current.table ? current.parts[part.value] : undefined
  const dom = current && range ? rangeOf(current, ...range) : undefined
  if (dom) CSS.highlights.set(HIGHLIGHT, new Highlight(dom))
  else CSS.highlights.delete(HIGHLIGHT)
}

function clearHighlight() {
  if (typeof CSS !== 'undefined' && 'highlights' in CSS) CSS.highlights.delete(HIGHLIGHT)
}

/** Scrolls the current block into view, unless the reader scrolled in the last few seconds. */
function follow(force: boolean) {
  const el = block.value?.el
  if (!el || (!force && Date.now() - lastUserScroll < FOLLOW_PAUSE_MS)) return
  if (document.querySelector('dialog[open]')) return
  const rect = el.getBoundingClientRect()
  const top = stickyHeaderBottom() + 16
  const player = document.querySelector('.listen-player')?.getBoundingClientRect()
  const bottom = Math.min(player?.top ?? window.innerHeight, window.innerHeight) - 16
  if (rect.top >= top && rect.bottom <= bottom) return
  const room = Math.max(bottom - top, 0)
  // A block that fits goes a quarter of the way down; a taller one starts at the top.
  const offset = rect.height < room ? room / 4 : 0
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({
    top: window.scrollY + rect.top - top - offset,
    behavior: smooth ? 'smooth' : 'instant',
  })
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

// Anything the reader does to move the page: scrolling, keys, the outline, a link, the scrollbar.
const USER_MOVES = ['wheel', 'touchmove', 'keydown', 'pointerdown', 'hashchange']

function onUserScroll(event: Event) {
  if (
    event.target instanceof Element &&
    event.target.closest('.listen-player, input, select, textarea')
  )
    return
  if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return
  lastUserScroll = Date.now()
}

function addFollowListeners() {
  for (const type of USER_MOVES) {
    window.addEventListener(type, onUserScroll, { passive: true })
  }
}

function removeFollowListeners() {
  for (const type of USER_MOVES) {
    window.removeEventListener(type, onUserScroll)
  }
  lastUserScroll = 0
}
