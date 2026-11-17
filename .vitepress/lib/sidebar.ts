import type { DefaultTheme } from 'vitepress'
import { escapeHtml, type CatalogSection } from './catalog.ts'

// Extra fields our sidebar item component reads to draw status marks.
export interface BookSidebarItem extends DefaultTheme.SidebarItem {
  path?: string
  kind?: 'written' | 'soon'
  sectionId?: string
  items?: BookSidebarItem[]
}

export function buildSidebar(catalog: CatalogSection[]): BookSidebarItem[] {
  return catalog.map((section) => {
    const overviewListed = section.pages.some((p) => p.path === section.overviewPath)
    return {
      text: escapeHtml(section.title),
      link: overviewListed ? undefined : section.overviewLink,
      collapsed: true,
      sectionId: section.id,
      items: section.pages.map((page) => ({
        text: escapeHtml(page.label),
        link: page.link,
        path: page.path,
        kind: page.kind,
      })),
    }
  })
}

export function buildNav(catalog: CatalogSection[]): DefaultTheme.NavItem[] {
  return catalog.map((section) => ({
    text: section.nav,
    link: section.overviewLink,
    activeMatch: `^${section.overviewLink}`,
  }))
}
