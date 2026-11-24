import type { CatalogPage } from '../lib/catalog.ts'
import type { PageProgress } from './progress/store.ts'

/** Written designs first, then coming soon, each in index order. */
export function designOrder(pages: readonly CatalogPage[]): CatalogPage[] {
  return [...pages].sort((a, b) => Number(a.kind === 'soon') - Number(b.kind === 'soon'))
}

export function readLabel(entry: PageProgress | undefined): string {
  if (!entry) return 'Not started'
  if (entry.status === 'done') return 'Done'
  return `${Math.round(entry.position * 100)}% read`
}

export function readAction(entry: PageProgress | undefined): string {
  if (!entry) return 'Start reading'
  return entry.status === 'done' ? 'Read again' : 'Continue'
}

// Index summaries follow a colon, so they start in lower case.
export function sentence(text = ''): string {
  return text.replace(/^[a-z]/, (c) => c.toUpperCase())
}
