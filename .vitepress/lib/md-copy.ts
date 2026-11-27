// Shared by the build and the browser, so it imports nothing from Node.

/** Where a page's .md copy is: `/learn/framework/` → `learn/framework.md`. */
export function mdCopyPath(link: string): string {
  const path = link.replace(/^\/|\/$/g, '')
  return (path || 'index') + '.md'
}
