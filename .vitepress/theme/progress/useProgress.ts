import { useData } from 'vitepress'
import { computed, onMounted, ref, shallowRef, type ComputedRef } from 'vue'
import type { ThemeConfig } from '../../config.mts'
import { createProgressStore, type ProgressStore } from './store.ts'

// One store for the whole app. It stays empty and "unknown" during server rendering and the
// first client render, so the HTML never shows progress the browser would contradict.
let store: ProgressStore | undefined
const revision = shallowRef(0)
const loaded = ref(false)

/** A path whose automatic status changes are paused after "Reset this page". */
export const pausedPath = ref<string>()

export function useProgress() {
  const { theme } = useData<ThemeConfig>()
  const current = (store ??= createProgressStore({ catalog: theme.value.catalog }))

  onMounted(() => {
    if (loaded.value) return
    current.subscribe(() => revision.value++)
    current.load()
    loaded.value = true
  })

  /** A computed value from the store that updates on every change, and is undefined until loaded. */
  function track<T>(read: (s: ProgressStore) => T): ComputedRef<T | undefined> {
    return computed(() => {
      void revision.value
      return loaded.value ? read(current) : undefined
    })
  }

  return { store: current, loaded, track }
}
