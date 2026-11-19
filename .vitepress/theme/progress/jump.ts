// Jumping to a section from the "On this page" outline: a short eased scroll (snappier than
// the browser's own smooth scroll), the section shown as current straight away, and the URL
// hash updated the way VitePress's router does it. The outline is marked .vp-raw, which makes
// VitePress's router leave its clicks to us.
import { pinnedHeading } from './live.ts'

/** Where the sticky header ends once the page has scrolled (it moves on phones). */
export function stickyHeaderBottom(): number {
  const local = document.querySelector<HTMLElement>('.VPLocalNav')
  if (local && getComputedStyle(local).display !== 'none') {
    return (parseFloat(getComputedStyle(local).top) || 0) + local.offsetHeight
  }
  return document.querySelector<HTMLElement>('.VPNav')?.offsetHeight ?? 64
}

const easeOut = (t: number) => 1 - (1 - t) ** 3
const INTERRUPTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

let stopCurrent: (() => void) | undefined
let landing: number | undefined

/** True while a jump is scrolling. */
export const isJumping = () => stopCurrent !== undefined

/** Where the last jump ended, so a later scroll away from it can unpin the section. */
export const lastLanding = () => landing

/** Scrolls to `target` in 220–450 ms, or at once with reduced motion. The reader can interrupt. */
function scrollQuickly(target: number, done: () => void) {
  stopCurrent?.()
  const start = window.scrollY
  const distance = target - start
  if (Math.abs(distance) < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({ top: target, behavior: 'instant' })
    done()
    return
  }
  const duration = Math.min(450, 220 + Math.abs(distance) / 25)
  const began = performance.now()
  let frame = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    INTERRUPTS.forEach((type) => window.removeEventListener(type, stop))
    stopCurrent = undefined
  }
  const step = (now: number) => {
    const progress = Math.min((now - began) / duration, 1)
    window.scrollTo({ top: start + distance * easeOut(progress), behavior: 'instant' })
    if (progress < 1) {
      frame = requestAnimationFrame(step)
    } else {
      stop()
      done()
    }
  }
  INTERRUPTS.forEach((type) => window.addEventListener(type, stop, { passive: true }))
  stopCurrent = stop
  frame = requestAnimationFrame(step)
}

export function jumpToHeading(heading: HTMLElement, hash: string) {
  // The hashchange goes first: listeners unpin on it, and this jump's pin must survive.
  if (window.location.hash !== hash) {
    const oldURL = window.location.href
    history.pushState({}, '', hash)
    window.dispatchEvent(
      new HashChangeEvent('hashchange', { oldURL, newURL: window.location.href }),
    )
  }
  pinnedHeading.value = heading.id
  // Where VitePress puts a heading: its text 24 px under the header, padding included.
  const padding = parseFloat(getComputedStyle(heading).paddingTop) || 0
  const max = document.documentElement.scrollHeight - window.innerHeight
  const top =
    window.scrollY + heading.getBoundingClientRect().top - stickyHeaderBottom() - 24 + padding
  landing = Math.min(Math.max(top, 0), max)
  scrollQuickly(landing, () => heading.focus({ preventScroll: true }))
}
