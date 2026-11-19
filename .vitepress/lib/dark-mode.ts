/**
 * Runs in <head> before VitePress's own dark-mode script (VitePress adds it after all of ours),
 * which reads localStorage without a try: with storage blocked it throws, and the page would show
 * light first on a dark device. Only when storage can't be read, this applies the device's
 * setting instead. It matches the default `appearance: true`; recheck it if that config changes.
 */
export function darkModeFallbackScript(): string {
  return `try{localStorage.length}catch(e){if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}`
}
