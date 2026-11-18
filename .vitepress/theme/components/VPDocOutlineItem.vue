<script setup lang="ts">
// Our copy of VitePress 1.6.4's VPDocOutlineItem.vue, swapped in by an alias in the config.
// It keeps the name because it renders itself recursively. Change: a section the reader has
// finished gets a tick. Recheck it when upgrading VitePress.
import { readHeadings } from '../progress/live.ts'

interface MenuItem {
  title: string
  link: string
  children?: MenuItem[]
}

defineProps<{
  headers: MenuItem[]
  root?: boolean
}>()

const isRead = (link: string) => readHeadings.value.has(decodeURIComponent(link.slice(1)))

function onClick({ target }: Event) {
  const id = (target as HTMLElement).closest('a')?.href.split('#')[1]
  if (!id) return
  document.getElementById(decodeURIComponent(id))?.focus({ preventScroll: true })
}
</script>

<template>
  <ul class="VPDocOutlineItem" :class="root ? 'root' : 'nested'">
    <!-- "read" sits on the <li>: VitePress sets "active" on the link itself, and a class
         binding there would wipe it. -->
    <li v-for="{ children, link, title } in headers" :key="link" :class="{ read: isRead(link) }">
      <a class="outline-link" :href="link" :title="title" @click="onClick">
        <span class="title">{{ title }}</span>
        <svg
          v-if="isRead(link)"
          class="tick"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            d="m3.5 8.4 2.9 2.9 6-6.3"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span v-if="isRead(link)" class="visually-hidden">, read</span>
      </a>
      <template v-if="children?.length">
        <VPDocOutlineItem :headers="children" />
      </template>
    </li>
  </ul>
</template>

<style scoped>
.root {
  position: relative;
  z-index: 1;
}

.nested {
  padding-right: 16px;
  padding-left: 16px;
}

.outline-link {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  line-height: 32px;
  font-size: 14px;
  font-weight: 400;
  color: var(--vp-c-text-2);
  transition: color 0.5s;
}

.title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outline-link:hover,
.outline-link.active {
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.tick {
  flex: none;
  color: var(--vp-c-brand-1);
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
