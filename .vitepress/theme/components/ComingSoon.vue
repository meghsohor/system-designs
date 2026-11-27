<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { ThemeConfig } from '../../config.mts'

const { frontmatter, page, theme } = useData<ThemeConfig>()

const section = computed(() =>
  theme.value.catalog.find((s) => s.pages.some((p) => p.path === page.value.relativePath)),
)
// `next` can also be plain text or false in front matter; only an object has a link.
const next = computed(() => {
  const value: unknown = frontmatter.value.next
  return typeof value === 'object' && value !== null && 'link' in value
    ? (value as { text: string; link: string })
    : undefined
})
</script>

<template>
  <aside
    v-if="frontmatter.pageKind === 'soon'"
    class="coming-soon"
    aria-labelledby="coming-soon-title"
  >
    <p id="coming-soon-title" class="title">Coming soon</p>
    <p>This page isn't written yet. It will appear here once it is.</p>
    <ul>
      <li v-if="section">
        <a :href="withBase(section.overviewLink)">Back to {{ section.title }}</a>
      </li>
      <li v-if="next">
        <a :href="withBase(next.link)">Read next: {{ next.text }}</a>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.coming-soon {
  margin: 24px 0 32px;
  padding: 20px 24px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.title {
  margin: 0 0 4px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.coming-soon p {
  margin: 0;
  color: var(--vp-c-text-2);
}
.coming-soon ul {
  margin: 12px 0 0;
  padding-left: 20px;
}
.coming-soon a {
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.coming-soon a:hover {
  color: var(--vp-c-brand-2);
}
</style>
