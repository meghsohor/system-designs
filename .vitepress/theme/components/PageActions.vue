<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ThemeConfig } from '../../config.mts'
import { mdCopyPath } from '../../lib/md-copy.ts'
import { close, initListening, open, start, supported } from '../listen/player.ts'
import { useProgress } from '../progress/useProgress.ts'
import { showToast } from '../toast.ts'

// Buttons under a written page's title: the quiz button on designs that have one, "Listen"
// and "Copy page".
const { page, theme } = useData<ThemeConfig>()
const { loaded, track } = useProgress()
const mounted = ref(false)

const entry = computed(() =>
  theme.value.catalog.flatMap((s) => s.pages).find((p) => p.path === page.value.relativePath),
)
const quiz = track((s) => (entry.value?.quiz ? s.getQuiz(entry.value.quiz) : undefined))

onMounted(() => {
  mounted.value = true
  initListening()
})

// The page's markdown, as AI agents get it; the service worker keeps a copy for offline use.
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(copiedTimer))

async function copyPage() {
  if (!entry.value) return
  const text = fetch(withBase('/' + mdCopyPath(entry.value.link))).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  })
  try {
    // Safari only allows a copy during the click, so the clipboard waits for the download.
    if (typeof ClipboardItem === 'function') {
      const blob = text.then((t) => new Blob([t], { type: 'text/plain' }))
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    } else {
      await navigator.clipboard.writeText(await text)
    }
  } catch {
    showToast({ message: "Couldn't copy the page. Try again." })
    return
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="page-actions">
    <!-- Hidden until progress loads, so "Take" never flips to "Retake" in view. -->
    <a
      v-if="entry?.quizLink"
      class="quiz-button"
      :class="{ waiting: !loaded }"
      :href="withBase(entry.quizLink)"
    >
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
    <!-- In the server HTML but hidden, so the row keeps its height; removed if speech is missing. -->
    <button
      v-if="!mounted || supported"
      type="button"
      class="listen-button"
      :class="{ waiting: !mounted }"
      :aria-expanded="open"
      aria-controls="listen-player"
      @click="open ? close() : start()"
    >
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
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        <rect x="3" y="14" width="4" height="6" rx="1.5" />
        <rect x="17" y="14" width="4" height="6" rx="1.5" />
      </svg>
      {{ open ? 'Listening' : 'Listen' }}
    </button>
    <button
      v-if="entry"
      type="button"
      class="copy-button"
      title="Copy page as markdown"
      @click="copyPage"
    >
      <svg
        v-if="copied"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <svg
        v-else
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
        <rect x="8" y="8" width="13" height="13" rx="2.5" />
        <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
      </svg>
      <span aria-live="polite">
        <template v-if="copied">Copied</template>
        <template v-else>Copy page<span class="visually-hidden"> as markdown</span></template>
      </span>
    </button>
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

.page-actions:not(:has(> *)) {
  display: none;
}

.quiz-button,
.listen-button,
.copy-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  transition: background-color 0.2s;
}

.quiz-button {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
}

.quiz-button:hover {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-hover-bg);
}

.listen-button {
  padding-inline: 14px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.listen-button:hover {
  background: color-mix(in srgb, var(--vp-c-brand-1) 20%, transparent);
}

.copy-button {
  padding-inline: 14px;
  color: var(--vp-c-text-1);
  background: var(--book-chip);
}

.copy-button:hover {
  background: var(--book-chip-hover);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.quiz-button:focus-visible,
.listen-button:focus-visible,
.copy-button:focus-visible {
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
