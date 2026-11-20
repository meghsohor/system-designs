<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, ref } from 'vue'
import type { CatalogPage, CatalogSection } from '../../lib/catalog.ts'
import type { ThemeConfig } from '../../config.mts'
import { useProgress } from '../progress/useProgress.ts'
import { showToast } from '../toast.ts'

const { theme } = useData<ThemeConfig>()
const { store, loaded, track } = useProgress()

const heading = ref<HTMLHeadingElement>()
const dialog = ref<HTMLDialogElement>()
const quizResets = new Map<string, HTMLButtonElement>()

const sections = computed(() => theme.value.catalog)
const hasWritten = (section: CatalogSection) => section.pages.some((p) => p.kind === 'written')
const tracked = computed(() => sections.value.filter(hasWritten))
const comingSoon = computed(() => sections.value.filter((s) => !hasWritten(s)))
const written = computed(() =>
  sections.value.flatMap((s) => s.pages).filter((p) => p.kind === 'written'),
)
const quizPages = computed(() => written.value.filter((p) => p.quiz))
const total = computed(() => written.value.length)

// Everything the page shows from saved progress; undefined until it loads in the browser.
const saved = track((s) => ({
  summary: s.summary(),
  mode: s.mode,
  lastPage: s.lastPage(),
  quizzes: new Map(quizPages.value.map((p) => [p.path, p.quiz ? s.getQuiz(p.quiz) : undefined])),
}))

const done = computed(() => saved.value?.summary.done ?? 0)
const overall = computed(() => (total.value ? done.value / total.value : 0))
const pagesStarted = computed(() =>
  saved.value ? saved.value.summary.done + saved.value.summary.inProgress : 0,
)
const quizzesTaken = computed(() => quizPages.value.filter((p) => saved.value?.quizzes.get(p.path)))
const hasSaved = computed(
  () =>
    pagesStarted.value > 0 || quizzesTaken.value.length > 0 || saved.value?.lastPage !== undefined,
)

// Progress saved by a newer version is left alone, so there's nothing here to reset.
const isNewer = computed(
  () => saved.value?.mode.kind === 'memory' && saved.value.mode.reason === 'newer',
)
const isStored = computed(() => saved.value?.mode.kind === 'stored')

const notice = computed(() => {
  const mode = saved.value?.mode
  if (mode?.kind !== 'memory') return ''
  if (mode.reason === 'blocked') {
    return "This browser isn't letting the site save anything, as in a private window or with cookies blocked. What you read now shows here until you close or reload the page."
  }
  return 'A newer version of this site saved progress on this device, so this page leaves it alone and shows only what you do now. Reloading the page should bring the newer version.'
})

function sectionCount(section: CatalogSection) {
  const counts = saved.value?.summary.sections.find((s) => s.id === section.id)
  return {
    done: counts?.done ?? 0,
    total: section.pages.filter((p) => p.kind === 'written').length,
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// What "Reset all progress" clears, with real counts.
const clears = computed(() => {
  const items: string[] = []
  if (pagesStarted.value > 0) {
    items.push(`Reading progress for ${plural(pagesStarted.value, 'page', 'pages')}`)
  }
  if (pagesStarted.value > 0 || saved.value?.lastPage) items.push('Your saved places')
  const quizzes = quizzesTaken.value
  if (quizzes.length > 0) {
    const names = quizzes.map((p) => p.label).join(', ')
    items.push(`${plural(quizzes.length, 'quiz score', 'quiz scores')} (${names})`)
  }
  return items
})

function quizOf(page: CatalogPage) {
  return saved.value?.quizzes.get(page.path)
}

function setQuizReset(path: string, el: unknown) {
  if (el instanceof HTMLButtonElement) quizResets.set(path, el)
  else quizResets.delete(path)
}

function resetQuiz(page: CatalogPage) {
  const quizPath = page.quiz
  if (!quizPath) return
  // What was saved at the moment of the reset, which another tab may have changed.
  const quiz = store.resetQuiz(quizPath)
  if (!quiz) return
  // The Reset button disappears, so focus goes to Undo.
  showToast({
    message: 'Quiz score reset',
    duration: 6000,
    focusAction: true,
    action: {
      label: 'Undo',
      run: () => {
        store.restore({ path: page.path, quizPath, quiz })
        void nextTick(() => quizResets.get(page.path)?.focus())
      },
    },
  })
}

function resetAll() {
  store.resetAll()
  dialog.value?.close()
  // The button that opened the dialog is gone, so focus moves to the top of the page.
  void nextTick(() => heading.value?.focus())
  showToast({ message: 'All progress reset' })
}

// A click on the dialog itself, outside its card, is a click on the backdrop. It must also
// start there, so a text selection dragged out of the card doesn't close it.
let pressedBackdrop = false
function onDialogPointerDown(event: PointerEvent) {
  pressedBackdrop = event.target === dialog.value
}
function onDialogClick(event: MouseEvent) {
  if (pressedBackdrop && event.target === dialog.value) dialog.value.close()
  pressedBackdrop = false
}
</script>

<template>
  <div class="progress-page">
    <div>
      <h1 ref="heading" class="title" tabindex="-1">Your progress</h1>
      <!-- When nothing can be saved, the notice says why instead. -->
      <p v-if="!notice" class="lead">Saved on this device only.</p>
      <p v-else class="notice">{{ notice }}</p>
    </div>

    <!-- Room is kept until progress loads, so the page doesn't jump. -->
    <div class="overall" :class="{ waiting: !loaded }">
      <p class="figures">
        <!-- Rounded down, so 100% means every page is done. -->
        <span class="percent">{{ Math.floor(overall * 100) }}%</span>
        <span>
          {{ done }} of {{ total }} pages<template v-if="quizPages.length > 0">
            · {{ plural(quizzesTaken.length, 'quiz', 'quizzes') }} taken</template
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
    </div>

    <section aria-labelledby="by-section">
      <h2 id="by-section" class="heading">By section</h2>
      <ul class="rows">
        <li v-for="section in tracked" :key="section.id" class="row">
          <span>{{ section.title }}</span>
          <span class="count" :class="{ waiting: !loaded }">
            <span aria-hidden="true">
              {{ sectionCount(section).done }} / {{ sectionCount(section).total }}
            </span>
            <span class="visually-hidden">
              {{ sectionCount(section).done }} of {{ sectionCount(section).total }} pages done
            </span>
          </span>
        </li>
        <li v-if="comingSoon.length > 0" class="row soon">
          <span>{{ comingSoon.map((s) => s.title).join(', ') }}</span>
          <span class="soon-label">Coming soon</span>
        </li>
      </ul>
    </section>

    <section v-if="quizPages.length > 0" aria-labelledby="quiz-scores">
      <h2 id="quiz-scores" class="heading">Quiz scores</h2>
      <ul class="rows">
        <li v-for="page in quizPages" :key="page.path" class="row quiz-row">
          <span class="quiz-name">
            <span>{{ page.label }}</span>
            <span class="quiz-score" :class="{ waiting: !loaded }">
              <template v-if="quizOf(page)">
                Last {{ quizOf(page)?.last.score }} / {{ quizOf(page)?.last.total }} · best
                {{ quizOf(page)?.best.score }} / {{ quizOf(page)?.best.total }}
              </template>
              <template v-else>Not taken yet</template>
            </span>
          </span>
          <button
            v-if="quizOf(page)"
            :ref="(el) => setQuizReset(page.path, el)"
            type="button"
            class="small-button"
            :aria-label="`Reset ${page.label} quiz score`"
            @click="resetQuiz(page)"
          >
            Reset
          </button>
        </li>
      </ul>
    </section>

    <template v-if="saved">
      <button
        v-if="hasSaved && !isNewer"
        type="button"
        class="reset-all"
        @click="dialog?.showModal()"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
        Reset all progress
      </button>
      <p v-else-if="!isNewer" class="empty">Nothing saved yet. Pages you read show up here.</p>
    </template>

    <p class="tip">
      <strong>On iPhone or iPad:</strong> Safari can delete a site's saved data when you haven't
      visited it for a week. Add this site to your Home Screen (Share, then Add to Home Screen) to
      keep it. The Home Screen app starts with its own empty progress.
    </p>

    <!-- Esc closes a modal dialog natively; the click handler only adds closing on the backdrop. -->
    <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
    <dialog
      ref="dialog"
      class="reset-dialog"
      role="alertdialog"
      aria-labelledby="reset-title"
      aria-describedby="reset-what reset-keeps"
      @pointerdown="onDialogPointerDown"
      @click="onDialogClick"
    >
      <div class="sheet">
        <h2 id="reset-title" class="sheet-title">Reset all progress?</h2>
        <div id="reset-what">
          <p v-if="isStored">This clears on this device:</p>
          <p v-else>This clears what you read on this visit:</p>
          <ul>
            <li v-for="item in clears" :key="item">{{ item }}</li>
          </ul>
        </div>
        <p id="reset-keeps" class="keeps">
          Your text size, theme, voice and speed settings stay. This can't be undone.
        </p>
        <div class="sheet-actions">
          <!-- eslint-disable-next-line vuejs-accessibility/no-autofocus -->
          <button type="button" class="cancel" autofocus @click="dialog?.close()">Cancel</button>
          <button type="button" class="confirm-button" @click="resetAll">Reset everything</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.progress-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 20px 96px;
}

.title {
  margin: 0;
  font-family: var(--book-font-display);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

.title:focus {
  outline: none;
}

.lead {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.notice {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-left: 4px solid var(--vp-c-warning-1);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  background: var(--vp-c-warning-soft);
}

.overall {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
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
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--vp-c-brand-1);
}

.heading {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 8px 0;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.count {
  font-weight: 600;
  white-space: nowrap;
}

.row.soon {
  color: var(--vp-c-text-2);
}

.soon-label {
  white-space: nowrap;
}

.quiz-name {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.quiz-score {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.small-button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
}

.small-button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.reset-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  border: 1px solid var(--book-danger-border);
  border-radius: 12px;
  font-weight: 600;
  color: var(--book-danger);
  background: var(--vp-c-bg);
}

.reset-all:hover {
  border-color: var(--book-danger);
}

.empty {
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.tip {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.tip strong {
  color: var(--vp-c-text-1);
}

/* A sheet from the bottom on phones, a centred card from 640 px. */
.reset-dialog {
  width: 100%;
  max-width: 100%;
  margin: auto 0 0;
  padding: 0;
  border: 0;
  border-radius: 20px 20px 0 0;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.reset-dialog::backdrop {
  background: rgba(15, 23, 42, 0.5);
}

@media (min-width: 640px) {
  .reset-dialog {
    width: min(440px, calc(100% - 32px));
    margin: auto;
    border: 1px solid var(--vp-c-divider);
    border-radius: 16px;
  }
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
  font-size: 15px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.sheet-title {
  margin: 0;
  font-family: var(--book-font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.sheet p,
.sheet ul {
  margin: 0;
}

.sheet ul {
  margin-top: 4px;
  padding-left: 20px;
  list-style: disc;
}

.keeps {
  font-size: 14px;
}

.sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.sheet-actions button {
  flex: 1;
  min-height: 50px;
  border-radius: 12px;
  font-weight: 600;
}

.cancel {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.cancel:hover {
  background: var(--vp-c-default-2);
}

.confirm-button {
  color: #fff;
  background: var(--book-danger-fill);
}

.confirm-button:hover {
  background: var(--book-danger-fill-hover);
}

.small-button:focus-visible,
.reset-all:focus-visible,
.sheet-actions button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.waiting {
  visibility: hidden;
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
