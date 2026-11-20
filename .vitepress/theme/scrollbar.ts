/**
 * Call just before opening a modal. The page behind stops scrolling, and keeps the scrollbar's
 * space only if it had a scrollbar; reserving it on a page without one moves everything left.
 */
export function noteScrollbar() {
  const html = document.documentElement
  html.classList.toggle('has-scrollbar', window.innerWidth > html.clientWidth)
}
