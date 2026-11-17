import { fileURLToPath } from 'node:url'
import { renderDiagrams, summary } from '../.vitepress/lib/mermaid.ts'

const contentDir = fileURLToPath(new URL('../content', import.meta.url))
// The dev server should start even while a diagram has a syntax error.
const keepGoing = process.argv.includes('--keep-going')

try {
  const result = await renderDiagrams(contentDir, { prune: true, keepGoing })
  for (const message of result.failed) console.error(message)
  console.log(summary(result, contentDir))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
