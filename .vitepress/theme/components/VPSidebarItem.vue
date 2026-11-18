<script setup lang="ts">
// Our copy of VitePress 1.6.4's VPSidebarItem.vue, swapped in by an alias in the config. It
// keeps the name because it renders itself recursively. Changes: groups are <details> with a
// "done / total" count, and page items show a status mark. Recheck it when upgrading VitePress.
import { withBase } from 'vitepress'
import { computed, ref, watch } from 'vue'
import { useSidebarControl } from 'vitepress/dist/client/theme-default/composables/sidebar.js'
import type { BookSidebarItem } from '../../lib/sidebar.ts'
import { useProgress } from '../progress/useProgress.ts'
import StatusMark from './StatusMark.vue'

const props = defineProps<{
  item: BookSidebarItem
  depth: number
}>()

const { isLink, isActiveLink, hasActiveLink, hasChildren } = useSidebarControl(
  computed(() => props.item),
)
const { track } = useProgress()

const isGroup = computed(() => props.depth === 0 && hasChildren.value)

// Open the group holding the current page, but never close one: a group the reader opened
// stays open when they move on, as in VitePress. So `open` is set once, then only ever to true.
const details = ref<HTMLDetailsElement>()
const startOpen = hasActiveLink.value
watch(hasActiveLink, (active) => {
  if (active && details.value) details.value.open = true
})
const tracked = computed(() => (props.item.items ?? []).filter((i) => i.kind === 'written'))
const count = track((s) => s.summary().sections.find((c) => c.id === props.item.sectionId))
const status = track((s) =>
  props.item.path && props.item.kind === 'written'
    ? (s.getPage(props.item.path)?.status ?? 'not-started')
    : undefined,
)

const classes = computed(() => [
  [`level-${props.depth}`],
  { 'is-link': isLink.value },
  { 'is-active': isActiveLink.value },
  { 'has-active': hasActiveLink.value },
])
</script>

<template>
  <details
    v-if="isGroup"
    ref="details"
    class="VPSidebarItem group"
    :class="classes"
    :open="startOpen"
  >
    <summary class="item">
      <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="m9 6 6 6-6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <!-- eslint-disable-next-line vue/no-v-html -- sidebar text is escaped when the sidebar is built -->
      <h2 class="text" v-html="item.text" />
      <span v-if="tracked.length === 0" class="pill">Soon</span>
      <span v-else-if="count" class="count">
        {{ count.done }} / {{ count.total }}
        <span class="visually-hidden">done</span>
      </span>
    </summary>
    <div class="items">
      <VPSidebarItem v-for="i in item.items" :key="i.text" :item="i" :depth="depth + 1" />
    </div>
  </details>

  <div v-else class="VPSidebarItem" :class="classes">
    <div v-if="item.text" class="item">
      <div class="indicator" />
      <a v-if="item.link" class="link" :href="withBase(item.link)">
        <!-- eslint-disable-next-line vue/no-v-html -- sidebar text is escaped when the sidebar is built -->
        <p class="text" v-html="item.text" />
        <span v-if="item.kind === 'soon'" class="soon">Soon</span>
        <StatusMark v-else-if="item.kind === 'written'" :status="status" />
      </a>
      <!-- eslint-disable-next-line vue/no-v-html -- sidebar text is escaped when the sidebar is built -->
      <p v-else class="text" v-html="item.text" />
    </div>
  </div>
</template>

<style scoped>
.group {
  padding-bottom: 10px;
}

.group[open] {
  padding-bottom: 20px;
}

.item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

summary.item {
  gap: 6px;
  min-height: 40px;
  cursor: pointer;
  list-style: none;
}

summary.item::-webkit-details-marker {
  display: none;
}

summary.item:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
  border-radius: 6px;
}

.chevron {
  flex: none;
  margin-left: -4px;
  color: var(--vp-c-text-3);
  transition: transform 0.25s;
}

.group[open] > summary .chevron {
  transform: rotate(90deg);
}

.indicator {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: -17px;
  width: 2px;
  border-radius: 2px;
  transition: background-color 0.25s;
}

.VPSidebarItem.level-1.is-active > .item > .indicator {
  background-color: var(--vp-c-brand-1);
}

.link {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-grow: 1;
  min-width: 0;
}

.text {
  flex-grow: 1;
  margin: 0;
  padding: 4px 0;
  line-height: 24px;
  font-size: 14px;
  transition: color 0.25s;
}

.group > summary .text {
  border: 0;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.level-1 .text {
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.level-1.is-link > .item > .link:hover .text {
  color: var(--vp-c-brand-1);
}

.level-1.is-active > .item .link > .text {
  color: var(--vp-c-brand-1);
}

.count {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.pill,
.soon {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.pill {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
}

.items {
  margin-left: 4px;
  padding-left: 16px;
  border-left: 1px solid var(--vp-c-divider);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
