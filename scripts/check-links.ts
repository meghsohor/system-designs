// Fails the build if any internal link, image or #anchor in the built site is broken.
import { checkSite } from '../.vitepress/lib/check-links.ts'

const { pages, problems } = checkSite('.vitepress/dist', '/system-designs/')
if (problems.length > 0) {
  console.error(
    `Link check failed (${problems.length}):\n` + problems.map((p) => `  ${p}`).join('\n'),
  )
  process.exit(1)
}
console.log(`Link check passed: ${pages} pages.`)
