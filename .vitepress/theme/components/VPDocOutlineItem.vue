<script setup lang="ts">
// Our copy of VitePress 1.6.4's VPDocOutlineItem.vue, swapped in by an alias in the config.
// It keeps the name because it renders itself recursively. Change: each section has a circle on
// the left, joined by a line: ticked once read, a ring for the section you're in, grey ahead.
// Recheck it when upgrading VitePress.
import { jumpToHeading } from '../progress/jump.ts'
import { currentHeadings, readHeadings, tracking } from '../progress/live.ts'

interface MenuItem {
  title: string
  link: string
  children?: MenuItem[]
}

defineProps<{
  headers: MenuItem[]
  root?: boolean
}>()

const idOf = (link: string) => decodeURIComponent(link.slice(1))
const isRead = (link: string) => readHeadings.value.has(idOf(link))
// The section you're in and the sections containing it (an h2 and its h3) are all current.
const isCurrent = (link: string) => currentHeadings.value.includes(idOf(link))
const isDeepest = (link: string) => currentHeadings.value.at(-1) === idOf(link)
// A parent's line to its first sub-section turns teal once you're inside it.
const isInside = (link: string) => isCurrent(link) && !isDeepest(link)

// Our own quick scroll. The list is .vp-raw, so VitePress's router (which sees clicks first)
// leaves these links to us.
function onClick(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = (event.target as HTMLElement).closest('a')
  const hash = link?.getAttribute('href')
  const heading = hash ? document.getElementById(idOf(hash)) : null
  if (!hash || !heading) return
  event.preventDefault()
  jumpToHeading(heading, hash)
}
</script>

<template>
  <ul
    class="VPDocOutlineItem"
    :class="[root ? 'root vp-raw' : 'nested', { untracked: root && !tracking }]"
  >
    <!-- State classes sit on the <li>: VitePress sets "active" on the link itself, and a class
         binding there would wipe it. -->
    <li
      v-for="{ children, link, title } in headers"
      :key="link"
      :class="{
        read: isRead(link),
        current: isCurrent(link),
        parent: children?.length,
        inside: isInside(link),
      }"
    >
      <span class="dot" aria-hidden="true">
        <svg v-if="isRead(link)" viewBox="0 0 16 16" width="10" height="10">
          <path
            d="m3 8.4 3.2 3.1L13 4.8"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <a
        class="outline-link"
        :href="link"
        :title="title"
        :aria-current="isDeepest(link) ? 'location' : undefined"
        @click="onClick"
      >
        {{ title }}<span v-if="isRead(link)" class="visually-hidden">, read</span>
      </a>
      <template v-if="children?.length">
        <VPDocOutlineItem :headers="children" />
      </template>
    </li>
  </ul>
</template>

<style scoped>
/* No colour transitions: scrolling past several sections quickly would restart overlapping
   fades and flicker. State changes are instant.
   Rows are 32 px; circles (14 px) sit in one column at the left, centred on each row. Nested
   rows indent their text, and pull their circle back into the column. */
.root {
  position: relative;
  z-index: 1;
}

.nested {
  padding-left: 14px;
}

li {
  position: relative;
}

/* The line from each circle to the next row's: the next section, or for a section with
   sub-sections, its first one. Teal once you've got past this row. */
li::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 16px;
  bottom: -16px;
  width: 2px;
  background: var(--vp-c-divider);
}

li.parent::before {
  bottom: auto;
  height: 32px;
}

.root > li:last-child:not(.parent)::before,
.root > li:last-child .nested > li:last-child::before {
  display: none;
}

li.read:not(.parent)::before,
li.parent.read::before,
li.parent.inside::before {
  background: var(--vp-c-brand-1);
}

.nested > li::before {
  left: -8px;
}

.dot {
  position: absolute;
  top: 9px;
  left: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 2px solid var(--vp-c-text-3);
  border-radius: 50%;
  background: var(--book-outline-bg, var(--vp-c-bg));
  color: var(--vp-c-bg);
}

.nested > li > .dot {
  left: -14px;
}

.read > .dot {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
}

.current > .dot {
  border-color: var(--vp-c-brand-1);
}

.outline-link {
  display: block;
  padding-left: 24px;
  line-height: 32px;
  font-size: 14px;
  font-weight: 400;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outline-link:hover {
  color: var(--vp-c-text-1);
}

.current > .outline-link {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* Pages without reading progress get VitePress's plain outline. */
.untracked .dot,
.untracked li::before {
  display: none;
}

.untracked .outline-link {
  padding-left: 0;
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
