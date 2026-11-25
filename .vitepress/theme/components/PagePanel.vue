<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, ref } from 'vue'
import type { ThemeConfig } from '../../config.mts'
import { pausedPath, useProgress } from '../progress/useProgress.ts'
import { showToast } from '../toast.ts'

// "This page" panel: under "On this page" from 1280 px, at the end of the page below that.
defineProps<{ placement: 'aside' | 'end' }>()

const { page, frontmatter, theme } = useData<ThemeConfig>()
const { store, loaded, track } = useProgress()
const resetButton = ref<HTMLButtonElement>()

const path = computed(() => page.value.relativePath)
const quizPath = computed(
  () => theme.value.catalog.flatMap((s) => s.pages).find((p) => p.path === path.value)?.quiz,
)
const entry = track((s) => s.getPage(path.value))
const quiz = track((s) => (quizPath.value ? s.getQuiz(quizPath.value) : undefined))
const mode = track((s) => s.mode)

const percent = computed(() => Math.round((entry.value?.position ?? 0) * 100))
const readLabel = computed(() => {
  if (entry.value?.status === 'done') return 'Done'
  if (!entry.value) return 'Not started'
  return `${percent.value}% read`
})
const barValue = computed(() => (entry.value?.status === 'done' ? 1 : (entry.value?.position ?? 0)))

const note = computed(() => {
  const current = mode.value
  if (current?.kind === 'memory' && current.reason === 'blocked') {
    return "This browser isn't saving progress, so it's gone when you close the page."
  }
  if (current?.kind === 'memory' && current.reason === 'full') {
    return "This browser's storage is full, so new progress is gone when you close the page."
  }
  if (current?.kind === 'memory') {
    return 'A newer version of this site saved progress here, so this page leaves it alone.'
  }
  return entry.value ? "Your place is saved. Next time you open this page, you'll land here." : ''
})

function reset() {
  const snapshot = store.resetPage(path.value)
  // Stop the page marking itself again while the reader is still on it.
  pausedPath.value = path.value
  // The reset button disappears, so focus goes to Undo.
  showToast({
    message: 'Page reset',
    duration: 6000,
    focusAction: true,
    action: {
      label: 'Undo',
      run: () => {
        store.restore(snapshot)
        pausedPath.value = undefined
        // The reset button is back once the page has progress again.
        void nextTick(() => resetButton.value?.focus())
      },
    },
  })
}
</script>

<template>
  <section
    v-if="loaded && frontmatter.pageKind === 'written'"
    class="page-panel"
    :class="placement"
    aria-label="Your progress on this page"
  >
    <p class="row">
      <span>This page</span>
      <span class="value">{{ readLabel }}</span>
    </p>
    <progress class="book-bar" max="1" :value="barValue" aria-label="This page, read" />
    <p v-if="quizPath" class="row quiz">
      <span>Quiz</span>
      <span class="value">
        {{
          quiz
            ? `last ${quiz.last.score} / ${quiz.last.total} · best ${quiz.best.score}`
            : 'Not taken yet'
        }}
      </span>
    </p>
    <p v-if="note" class="note">{{ note }}</p>
    <div class="actions">
      <button
        v-if="entry || quiz"
        ref="resetButton"
        type="button"
        class="action reset"
        @click="reset"
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
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
        Reset this page
      </button>
    </div>
  </section>
</template>

<style scoped>
.page-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.page-panel.aside {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

/* At the end of the page below 1280 px, where there's no right column. */
.page-panel.end {
  margin-top: 40px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  font-size: 14px;
}

@media (min-width: 1280px) {
  .page-panel.end {
    display: none;
  }
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.row.quiz {
  margin-top: 6px;
}

.value {
  color: var(--vp-c-text-2);
  font-weight: 500;
  text-align: right;
}

.note {
  margin: 0;
  color: var(--vp-c-text-2);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 600;
}

.action:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.action:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
