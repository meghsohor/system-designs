// VitePress ships no types for its internal theme modules. This covers the one our copy of
// VPSidebarItem uses; recheck it when upgrading VitePress.
declare module 'vitepress/dist/client/theme-default/composables/sidebar.js' {
  import type { DefaultTheme } from 'vitepress/theme'
  import type { ComputedRef, Ref } from 'vue'

  export function useSidebarControl(item: ComputedRef<DefaultTheme.SidebarItem>): {
    collapsed: Ref<boolean>
    collapsible: ComputedRef<boolean>
    isLink: ComputedRef<boolean>
    isActiveLink: Ref<boolean>
    hasActiveLink: ComputedRef<boolean>
    hasChildren: ComputedRef<boolean>
    toggle: () => void
  }
}
