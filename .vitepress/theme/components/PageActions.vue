<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed } from 'vue'
import type { ThemeConfig } from '../../config.mts'
import { useProgress } from '../progress/useProgress.ts'

// Buttons under a page's title; for now the quiz button on designs that have one.
const { page, theme } = useData<ThemeConfig>()
const { loaded, track } = useProgress()

const entry = computed(() =>
  theme.value.catalog.flatMap((s) => s.pages).find((p) => p.path === page.value.relativePath),
)
const quiz = track((s) => (entry.value?.quiz ? s.getQuiz(entry.value.quiz) : undefined))
</script>

<template>
  <div v-if="entry?.quizLink" class="page-actions">
    <!-- Hidden until progress loads, so "Take" never flips to "Retake" in view. -->
    <a class="quiz-button" :class="{ waiting: !loaded }" :href="withBase(entry.quizLink)">
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
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
      <span v-if="quiz">
        Retake the quiz
        <span class="detail">· last score {{ quiz.last.score }} / {{ quiz.last.total }}</span>
      </span>
      <span v-else>
        Take the quiz
        <span class="detail">
          · {{ entry.quizQuestions }} {{ entry.quizQuestions === 1 ? 'question' : 'questions' }}
        </span>
      </span>
    </a>
  </div>
</template>

<style scoped>
.page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.quiz-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 8px;
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  transition: background-color 0.2s;
}

.quiz-button:hover {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-hover-bg);
}

.quiz-button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

svg {
  flex: none;
}

.detail {
  font-weight: 500;
  opacity: 0.9;
}

.waiting {
  visibility: hidden;
}
</style>
