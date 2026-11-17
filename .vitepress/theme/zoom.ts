import mediumZoom from 'medium-zoom'

// Images inside a link keep working as links.
const IMAGES = '.vp-doc img:not(a img)'

// Zoom fits an image to the screen, so it only helps an image shown smaller than that.
function zoomHelps(img: HTMLImageElement): boolean {
  const { clientWidth, clientHeight } = document.documentElement
  return img.width < clientWidth && img.height < clientHeight
}

/** Sets up tap-to-zoom once; call the returned function after each page change. */
export function setUpZoom(): () => void {
  const zoom = mediumZoom({ background: 'var(--vp-c-bg)' })
  const zoomable = (target: EventTarget | null): target is HTMLImageElement =>
    target instanceof HTMLImageElement && zoom.getImages().includes(target)

  // Runs before medium-zoom's own click handler on the document, and stops it.
  document.addEventListener(
    'click',
    (event) => {
      if (zoomable(event.target) && !zoom.getZoomedImage() && !zoomHelps(event.target)) {
        event.stopPropagation()
      }
    },
    true,
  )
  // While zoomed the original is hidden and loses focus; give it back on close (Escape too).
  let returnFocus: HTMLElement | undefined
  zoom.on('closed', () => {
    returnFocus?.focus()
    returnFocus = undefined
  })
  // Tabbing away would reach links hidden behind the overlay.
  document.addEventListener('focusin', () => {
    if (zoom.getZoomedImage()) void zoom.close()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (zoom.getZoomedImage()) {
      event.preventDefault()
      void zoom.close()
    } else if (zoomable(event.target) && zoomHelps(event.target)) {
      event.preventDefault()
      returnFocus = event.target
      void zoom.open({ target: event.target })
    }
  })

  // Keyboard users get a focus stop only where it does something: an image zoom can enlarge,
  // or a diagram that scrolls sideways.
  const updateFocus = () => {
    for (const img of zoom.getImages()) {
      if (!(img instanceof HTMLImageElement)) continue
      const helps = zoomHelps(img)
      img.classList.toggle('book-no-zoom', !helps)
      if (helps) {
        img.tabIndex = 0
        img.setAttribute('role', 'button')
        img.setAttribute('aria-label', `Zoom: ${img.alt || 'image'}`)
      } else {
        img.removeAttribute('tabindex')
        img.removeAttribute('role')
        img.removeAttribute('aria-label')
      }
    }
    for (const box of document.querySelectorAll<HTMLElement>('.vp-doc .diagram')) {
      if (box.scrollWidth > box.clientWidth) {
        box.tabIndex = 0
        box.setAttribute('role', 'region')
        box.setAttribute(
          'aria-label',
          `${box.querySelector('img')?.alt ?? 'Diagram'}, scrolls sideways`,
        )
      } else {
        box.removeAttribute('tabindex')
        box.removeAttribute('role')
        box.removeAttribute('aria-label')
      }
    }
  }

  let frame = 0
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(updateFocus)
  })
  // Lazy images have no size until they load.
  document.addEventListener('load', (event) => zoomable(event.target) && updateFocus(), true)

  return () => {
    zoom.detach()
    zoom.attach(IMAGES)
    updateFocus()
  }
}
