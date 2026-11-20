<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { CatalogPage, CatalogSection } from '../../lib/catalog.ts'
import type { ThemeConfig } from '../../config.mts'
import type { PageProgress } from '../progress/store.ts'
import { useProgress } from '../progress/useProgress.ts'
import StatusMark from './StatusMark.vue'

const { theme } = useData<ThemeConfig>()
const { loaded, track } = useProgress()

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
const written = computed(() =>
  sections.value.flatMap((s) => s.pages).filter((p) => p.kind === 'written'),
)
const hasQuizzes = computed(() => written.value.some((p) => p.quiz))

// Everything the page shows from saved progress; undefined until it loads in the browser.
const saved = track((s) => ({
  summary: s.summary(),
  lastPage: s.lastPage(),
  mode: s.mode,
  pages: new Map(written.value.map((p) => [p.path, s.getPage(p.path)])),
  quizzes: new Map(written.value.map((p) => [p.path, p.quiz ? s.getQuiz(p.quiz) : undefined])),
}))

const quizzesTaken = computed(
  () => [...(saved.value?.quizzes.values() ?? [])].filter(Boolean).length,
)

const resume = computed(() => {
  const page = written.value.find((p) => p.path === saved.value?.lastPage)
  if (!page) return undefined
  const section = sections.value.find((s) => s.id === page.section)
  return { page, section: section?.title, entry: saved.value?.pages.get(page.path) }
})

// The cards under the intro wait until there's something to show.
const started = computed(
  () =>
    resume.value !== undefined ||
    quizzesTaken.value > 0 ||
    (saved.value !== undefined && saved.value.summary.done + saved.value.summary.inProgress > 0),
)

const overall = computed(() => {
  const summary = saved.value?.summary
  return summary?.total ? summary.done / summary.total : 0
})

const savedNote = computed(() => {
  const mode = saved.value?.mode
  if (mode?.kind === 'memory' && mode.reason === 'blocked') {
    return "This browser isn't saving progress, so it's gone when you close the page."
  }
  if (mode?.kind === 'memory') {
    return 'A newer version of this site saved progress here, so this page leaves it alone.'
  }
  return 'Saved on this device. No account needed.'
})

function hasWritten(section: CatalogSection): boolean {
  return section.pages.some((p) => p.kind === 'written')
}

// The total comes from the catalog, so the hidden placeholder already has its final width.
function sectionCount(section: CatalogSection) {
  const counts = saved.value?.summary.sections.find((s) => s.id === section.id)
  const total = section.pages.filter((p) => p.kind === 'written').length
  return { done: counts?.done ?? 0, total }
}

function readLabel(entry: PageProgress | undefined): string {
  if (!entry) return 'Not started'
  if (entry.status === 'done') return 'Done'
  return `${Math.round(entry.position * 100)}% read`
}

const barValue = (entry: PageProgress | undefined): number =>
  entry?.status === 'done' ? 1 : (entry?.position ?? 0)

const quizCount = (n: number): string => `${n} ${n === 1 ? 'quiz' : 'quizzes'}`

function lastQuiz(page: CatalogPage) {
  return saved.value?.quizzes.get(page.path)?.last
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
        <template v-if="resume">
          <a class="button brand" :href="withBase(resume.page.link)">
            Continue reading
            <span aria-hidden="true">→</span>
          </a>
          <!-- The framework is often the page being continued; then the designs are the other way in. -->
          <a
            v-if="framework && resume.page.path !== framework.overviewPath"
            class="button alt"
            :href="withBase(framework.overviewLink)"
          >
            Start with the framework
          </a>
          <a
            v-else-if="designSection"
            class="button alt"
            :href="withBase(designSection.overviewLink)"
          >
            Browse the designs
          </a>
        </template>
        <template v-else>
          <a v-if="framework" class="button brand" :href="withBase(framework.overviewLink)">
            Start with the framework
            <span aria-hidden="true">→</span>
          </a>
          <a v-if="designSection" class="button alt" :href="withBase(designSection.overviewLink)">
            Browse the designs
          </a>
        </template>
      </div>
    </section>

    <section v-if="saved && started" class="mine" aria-label="Your reading">
      <a v-if="resume" class="card" :href="withBase(resume.page.link)">
        <h2 class="eyebrow">Continue where you left off</h2>
        <span class="big-title">{{ resume.page.title }}</span>
        <span class="summary">{{ resume.section }} · {{ readLabel(resume.entry) }}</span>
        <progress
          class="book-bar"
          style="--book-bar-height: 6px"
          max="1"
          :value="barValue(resume.entry)"
          aria-hidden="true"
        />
        <span class="more">Resume <span aria-hidden="true">→</span></span>
      </a>
      <div class="card stats">
        <h2 class="eyebrow">Your progress</h2>
        <p class="figures">
          <span class="percent">{{ Math.floor(overall * 100) }}%</span>
          <span>
            {{ saved.summary.done }} of {{ saved.summary.total }} pages<template v-if="hasQuizzes">
              · {{ quizCount(quizzesTaken) }} taken</template
            >
          </span>
        </p>
        <progress
          class="book-bar"
          style="--book-bar-height: 6px"
          max="1"
          :value="overall"
          aria-label="All pages, done"
        />
        <p class="note">{{ savedNote }}</p>
        <a class="more details" :href="withBase('/progress')">
          Details and reset <span aria-hidden="true">→</span>
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
              <!-- Room is kept until progress loads, so the cards don't jump. -->
              <span v-else class="count" :class="{ waiting: !loaded }">
                <span aria-hidden="true">
                  {{ sectionCount(section).done }} / {{ sectionCount(section).total }}
                </span>
                <span class="visually-hidden">
                  {{ sectionCount(section).done }} of {{ sectionCount(section).total }} pages done
                </span>
              </span>
            </span>
            <span class="summary">{{ section.summary }}</span>
            <progress
              v-if="hasWritten(section)"
              class="book-bar section-bar"
              :class="{ waiting: !loaded }"
              max="1"
              :value="sectionCount(section).done / (sectionCount(section).total || 1)"
              aria-hidden="true"
            />
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
            <template v-else>
              <span class="summary">{{ sentence(page.summary) }}</span>
              <span v-if="saved?.pages.get(page.path)" class="status">
                <!-- The text beside it says the same, so screen readers skip the mark. -->
                <StatusMark aria-hidden="true" :status="saved.pages.get(page.path)?.status" />
                {{ readLabel(saved.pages.get(page.path)) }}
              </span>
              <span v-if="lastQuiz(page)" class="quiz">
                Quiz {{ lastQuiz(page)?.score }} / {{ lastQuiz(page)?.total }}
              </span>
            </template>
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

/* "Continue where you left off" and "Your progress", side by side from 640 px. */
.mine {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  margin-top: 32px;
}
@media (min-width: 640px) {
  .mine {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.mine .card {
  gap: 8px;
  border-radius: 14px;
}
.card.stats {
  border-color: transparent;
  background: var(--vp-c-bg-soft);
}
.eyebrow {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.big-title {
  font-family: var(--book-font-display);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
}
.figures {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 10px;
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-1);
}
.percent {
  font-family: var(--book-font-display);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--vp-c-brand-1);
}
.note {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.more {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.details {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  text-decoration: none;
}
.details:hover {
  text-decoration: underline;
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
a.card:hover {
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
.count {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--vp-c-brand-1);
}
.section-bar {
  margin-top: 4px;
}
.waiting {
  visibility: hidden;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.quiz {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
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
