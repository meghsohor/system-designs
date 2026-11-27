/** Note text sizes, as a multiple of the normal size. Index 1 is the default. */
export const TEXT_SCALES = [0.9, 1, 1.1, 1.25, 1.4] as const
export const DEFAULT_SCALE_INDEX = 1
export const TEXT_SIZE_KEY = 'sdi:text-size:v1'
export const TEXT_SCALE_VAR = '--book-text-scale'

/** The saved index, or the default when nothing valid is saved. */
export function scaleIndexOf(saved: string | null): number {
  const index = TEXT_SCALES.findIndex((scale) => String(scale) === saved)
  return index === -1 ? DEFAULT_SCALE_INDEX : index
}

/**
 * Runs in <head> before the page draws, so text never shows at the wrong size first
 * (the same way VitePress applies dark mode). Storage can be blocked, hence the try.
 */
export function textSizeScript(): string {
  const allowed = JSON.stringify(
    TEXT_SCALES.filter((_, i) => i !== DEFAULT_SCALE_INDEX).map(String),
  )
  return `try{var s=localStorage.getItem(${JSON.stringify(TEXT_SIZE_KEY)});if(${allowed}.indexOf(s)>-1)document.documentElement.style.setProperty(${JSON.stringify(TEXT_SCALE_VAR)},s)}catch(e){}`
}
