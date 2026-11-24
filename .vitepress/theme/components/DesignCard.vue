<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed } from 'vue'
import type { CatalogPage } from '../../lib/catalog.ts'
import { readAction, readLabel, sentence } from '../designs.ts'
import { useProgress } from '../progress/useProgress.ts'
import StatusMark from './StatusMark.vue'

const props = defineProps<{ page: CatalogPage }>()
const { loaded, track } = useProgress()

const saved = track((s) => ({
  entry: s.getPage(props.page.path),
  quiz: props.page.quiz ? s.getQuiz(props.page.quiz) : undefined,
}))
const entry = computed(() => saved.value?.entry)
const quiz = computed(() => saved.value?.quiz?.last)
const bar = computed(() => (entry.value?.status === 'done' ? 1 : (entry.value?.position ?? 0)))
const questions = computed(() => {
  const n = props.page.quizQuestions ?? 0
  return `${n} ${n === 1 ? 'question' : 'questions'}`
})
</script>

<template>
  <div v-if="page.kind === 'soon'" class="card pending">
    <span class="title">{{ page.label }}</span>
    <span class="soon">Coming soon</span>
  </div>
  <div v-else class="card">
    <span class="title">{{ page.label }}</span>
    <p class="summary">{{ sentence(page.summary) }}</p>
    <!-- Hidden until progress loads, so the numbers and the button label never change in view. -->
    <div class="stats" :class="{ waiting: !loaded }">
      <progress class="book-bar" max="1" :value="bar" aria-hidden="true" />
      <div class="stats-row">
        <span class="stat" :class="{ muted: !entry }">
          <!-- The text beside it says the same, so screen readers skip the mark. -->
          <StatusMark
            aria-hidden="true"
            :status="loaded ? (entry?.status ?? 'not-started') : undefined"
          />
          {{ readLabel(entry) }}
        </span>
        <span v-if="page.quiz" class="stat" :class="{ muted: !quiz }">
          <svg
            class="quiz-icon"
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
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <template v-if="quiz">Quiz {{ quiz.score }} / {{ quiz.total }}</template>
          <template v-else>Quiz · {{ questions }}</template>
        </span>
      </div>
    </div>
    <a class="button" :class="{ waiting: !loaded }" :href="withBase(page.link)">
      {{ readAction(entry) }}<span class="visually-hidden">: {{ page.label }}</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</template>

<style scoped>
/* Inside a doc page, so these also override VitePress's .vp-doc p and a styles. */
.card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  --scale: 1;
}

/* On a doc page the cards follow the reader's text size, like the text around them. */
.vp-doc .card {
  --scale: var(--book-text-scale, 1);
}

.card.pending {
  border-style: dashed;
}

.title {
  font-size: calc(17px * var(--scale));
  font-weight: 700;
  line-height: 1.35;
}

.summary {
  margin: 0;
  font-size: calc(14px * var(--scale));
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.soon {
  align-self: flex-start;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: calc(12px * var(--scale));
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  color: var(--vp-c-text-2);
  background: var(--vp-c-default-soft);
}

.stats {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: calc(13px * var(--scale));
  font-weight: 600;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}

.stat.muted {
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.quiz-icon {
  flex: none;
  color: var(--vp-c-brand-1);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  margin-top: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: calc(14px * var(--scale));
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  transition: background-color 0.2s;
}

.button:hover {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-hover-bg);
}

.button:focus-visible {
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
