import { decodeHTML } from 'entities'
import GithubSlugger, { slug } from 'github-slugger'

// Same heading IDs as GitHub, so #anchors work in both places.
// VitePress passes heading text with entities still encoded (&lt;), GitHub decodes them first.
export const slugify = (text: string): string => slug(decodeHTML(text))

export function headingIds(headings: string[]): string[] {
  const slugger = new GithubSlugger()
  return headings.map((h) => slugger.slug(decodeHTML(h)))
}
