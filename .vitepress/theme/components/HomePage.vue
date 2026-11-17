<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { CatalogSection } from '../../lib/catalog.ts'
import type { ThemeConfig } from '../../config.mts'

const { theme } = useData<ThemeConfig>()

const DESIGNS_SHOWN = 6

const sections = computed(() => theme.value.catalog)
const framework = computed(() => sections.value.find((s) => s.id === 'framework'))
const learn = computed(() => sections.value.filter((s) => s.id !== 'designs'))
const designSection = computed(() => sections.value.find((s) => s.id === 'designs'))
// Written designs first, then coming soon, each in index order.
const designs = computed(() =>
  [...(designSection.value?.pages ?? [])]
    .sort((a, b) => Number(a.kind === 'soon') - Number(b.kind === 'soon'))
    .slice(0, DESIGNS_SHOWN),
)

function hasWritten(section: CatalogSection): boolean {
  return section.pages.some((p) => p.kind === 'written')
}

// Index summaries follow a colon, so they start in lower case.
function sentence(text = ''): string {
  return text.replace(/^[a-z]/, (c) => c.toUpperCase())
}
</script>

<template>
  <div class="home">
    <section class="hero">
      <p class="badge">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18Z" />
          <path d="m9.5 13 2 2 3.5-3.5" />
        </svg>
        Works offline
      </p>
      <h1 class="title">System Design Interview</h1>
      <p class="tagline">
        Study notes for system design interviews: a step-by-step framework, the ideas and tools
        behind it, and worked designs.
      </p>
      <div class="actions">
        <a v-if="framework" class="button brand" :href="withBase(framework.overviewLink)">
          Start with the framework
          <span aria-hidden="true">→</span>
        </a>
        <a v-if="designSection" class="button alt" :href="withBase(designSection.overviewLink)">
          Browse the designs
        </a>
      </div>
    </section>

    <section class="block" aria-labelledby="learn-heading">
      <h2 id="learn-heading" class="heading">Learn</h2>
      <ul class="grid learn">
        <li v-for="section in learn" :key="section.id">
          <a class="card" :href="withBase(section.overviewLink)">
            <span class="card-top">
              <span class="card-title">{{ section.title }}</span>
              <span v-if="!hasWritten(section)" class="soon">Coming soon</span>
            </span>
            <span class="summary">{{ section.summary }}</span>
          </a>
        </li>
      </ul>
    </section>

    <section v-if="designSection" class="block" aria-labelledby="designs-heading">
      <div class="heading-row">
        <h2 id="designs-heading" class="heading">Designs</h2>
        <a class="see-all" :href="withBase(designSection.overviewLink)">
          See all {{ designSection.pages.length }} designs
        </a>
      </div>
      <ul class="grid designs">
        <li v-for="page in designs" :key="page.path">
          <a class="card" :class="{ pending: page.kind === 'soon' }" :href="withBase(page.link)">
            <span class="card-title">{{ page.label }}</span>
            <span v-if="page.kind === 'soon'" class="soon">Coming soon</span>
            <span v-else class="summary">{{ sentence(page.summary) }}</span>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 1152px;
  margin: 0 auto;
  padding: 48px 24px 96px;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  max-width: 720px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.title {
  margin: 0;
  font-family: var(--book-font-display);
  font-size: clamp(40px, 7vw, 56px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
}
.tagline {
  margin: 0;
  font-size: 18px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 22px;
  border-radius: 10px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.2s;
}
.button.brand {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
}
.button.brand:hover {
  background: var(--vp-button-brand-hover-bg);
}
.button.alt {
  color: var(--vp-button-alt-text);
  background: var(--vp-button-alt-bg);
}
.button.alt:hover {
  background: var(--vp-button-alt-hover-bg);
}

.block {
  margin-top: 56px;
}
.heading-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.heading {
  margin: 0 0 16px;
  font-family: var(--book-font-display);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.see-all {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.grid {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.grid.learn {
  grid-template-columns: 1fr;
}
.grid.designs {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
}
@media (min-width: 640px) {
  .grid.learn {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.grid li {
  display: flex;
}

.card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color 0.2s;
}
.card:hover {
  border-color: var(--vp-c-brand-1);
}
.card.pending {
  border-style: dashed;
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card-title {
  font-size: 17px;
  font-weight: 700;
}
.summary {
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.soon {
  align-self: flex-start;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--vp-c-text-2);
  background: var(--vp-c-default-soft);
}
</style>
