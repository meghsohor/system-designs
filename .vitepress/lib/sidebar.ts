import type { DefaultTheme } from 'vitepress'
import { escapeHtml, type CatalogSection } from './catalog.ts'

// Extra fields our sidebar item component reads to draw status marks.
export interface BookSidebarItem extends DefaultTheme.SidebarItem {
  path?: string
  kind?: 'written' | 'soon' | 'overview'
  sectionId?: string
  items?: BookSidebarItem[]
}

export function buildSidebar(catalog: CatalogSection[]): BookSidebarItem[] {
  return catalog.map((section) => {
    // Group headers only fold (they're <summary>), so an overview that isn't one of the
    // section's pages becomes the group's first item.
    const overviewListed = section.pages.some((p) => p.path === section.overviewPath)
    const overview: BookSidebarItem[] = overviewListed
      ? []
      : [
          {
            text: 'Overview',
            link: section.overviewLink,
            path: section.overviewPath,
            kind: 'overview',
          },
        ]
    return {
      text: escapeHtml(section.title),
      collapsed: true,
      sectionId: section.id,
      items: [
        ...overview,
        ...section.pages.map((page) => ({
          text: escapeHtml(page.label),
          link: page.link,
          path: page.path,
          kind: page.kind,
        })),
      ],
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
