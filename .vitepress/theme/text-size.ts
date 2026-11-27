import { computed, ref } from 'vue'
import {
  DEFAULT_SCALE_INDEX,
  TEXT_SCALE_VAR,
  TEXT_SCALES,
  TEXT_SIZE_KEY,
  scaleIndexOf,
} from '../lib/text-size.ts'

// One state for the nav button and the phone menu row.
const index = ref(DEFAULT_SCALE_INDEX)
const percent = computed(() => `${Math.round((TEXT_SCALES[index.value] ?? 1) * 100)}%`)

/** Reads the saved size; call from onMounted (the <head> script has already applied it). */
function load() {
  try {
    index.value = scaleIndexOf(localStorage.getItem(TEXT_SIZE_KEY))
  } catch {
    index.value = DEFAULT_SCALE_INDEX
  }
}

function set(next: number) {
  index.value = Math.min(Math.max(next, 0), TEXT_SCALES.length - 1)
  const scale = String(TEXT_SCALES[index.value])
  const isDefault = index.value === DEFAULT_SCALE_INDEX
  const root = document.documentElement.style
  if (isDefault) root.removeProperty(TEXT_SCALE_VAR)
  else root.setProperty(TEXT_SCALE_VAR, scale)
  try {
    if (isDefault) localStorage.removeItem(TEXT_SIZE_KEY)
    else localStorage.setItem(TEXT_SIZE_KEY, scale)
  } catch {
    // Storage blocked: the size still applies until the page is closed.
  }
}

export function useTextSize() {
  return {
    index,
    percent,
    load,
    set,
    smallest: computed(() => index.value === 0),
    largest: computed(() => index.value === TEXT_SCALES.length - 1),
    isDefault: computed(() => index.value === DEFAULT_SCALE_INDEX),
    smaller: () => set(index.value - 1),
    larger: () => set(index.value + 1),
    reset: () => set(DEFAULT_SCALE_INDEX),
  }
}
