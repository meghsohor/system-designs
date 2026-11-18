import { ref, shallowRef } from 'vue'

// Where the reader is on the current written page, right now. Set by ReadingTracker, read by
// the "On this page" ring and the outline ticks. Undefined/empty off written pages, and during
// server rendering, so nothing renders until the browser has measured the page.

/** 0–1 through the page's content. */
export const liveFraction = ref<number>()

/** Ids of the headings whose sections the reader has finished. */
export const readHeadings = shallowRef<ReadonlySet<string>>(new Set())
