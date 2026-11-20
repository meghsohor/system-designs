<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { ThemeConfig } from '../../config.mts'
import { useProgress } from '../progress/useProgress.ts'
import { showToast } from '../toast.ts'

// The question, option and explanation HTML comes from our own quiz.md files, rendered at
// build time by markdown-it without raw HTML.
interface Question {
  number: number
  text: string
  html: string
  options: Array<{ html: string; correct: boolean }>
  multiple: boolean
  explanation: string
  review: { text: string; link: string }
}

const props = defineProps<{ quiz: { title: string; questions: Question[] } }>()

const { page, theme } = useData<ThemeConfig>()
const { store, track } = useProgress()

const quizPath = computed(() => page.value.relativePath)
const design = computed(() =>
  theme.value.catalog.flatMap((s) => s.pages).find((p) => p.quiz === quizPath.value),
)
const saved = track((s) => s.getQuiz(quizPath.value))

const questions = computed(() => props.quiz.questions)
const total = computed(() => questions.value.length)

// Options keep file order in the server HTML and are shuffled once the page is running.
const ready = ref(false)
const orders = ref(questions.value.map((q) => q.options.map((_, i) => i)))
const index = ref(0)
const checked = ref(false)
const chosen = ref<number[]>([])
const answers = ref<boolean[]>([])
const finished = ref(false)
const needAnswer = ref(false)

const heading = ref<HTMLElement>()
const submit = ref<HTMLButtonElement>()
const resultHeading = ref<HTMLElement>()
const resetButton = ref<HTMLButtonElement>()

const question = computed(() => questions.value[index.value])
const order = computed(() => orders.value[index.value] ?? [])
const score = computed(() => answers.value.filter(Boolean).length)
const isRight = computed(() => answers.value[index.value] === true)
const isLast = computed(() => index.value + 1 >= total.value)

function shuffled(count: number): number[] {
  const list = Array.from({ length: count }, (_, i) => i)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j] as number, list[i] as number]
  }
  return list
}

function clearAnswer() {
  checked.value = false
  chosen.value = []
  needAnswer.value = false
}

// Focus goes to the new question's heading, with the page back at the top.
function showQuestion() {
  void nextTick(() => {
    window.scrollTo(0, 0)
    heading.value?.focus({ preventScroll: true })
  })
}

function start() {
  orders.value = questions.value.map((q) => shuffled(q.options.length))
  index.value = 0
  answers.value = []
  finished.value = false
  clearAnswer()
}

onMounted(() => {
  start()
  ready.value = true
})

// In dev, an edited quiz.md arrives as new props; start again so options match.
watch(() => props.quiz, start)

function choose(i: number, event: Event) {
  const on = (event.target as HTMLInputElement).checked
  if (!question.value?.multiple) chosen.value = [i]
  else chosen.value = on ? [...chosen.value, i] : chosen.value.filter((n) => n !== i)
}

function optionState(i: number): string {
  const option = question.value?.options[i]
  if (!checked.value) return chosen.value.includes(i) ? 'selected' : ''
  // A filled, ticked box would look as if the reader had ticked it.
  if (option?.correct && question.value?.multiple && !chosen.value.includes(i))
    return 'right not-chosen'
  if (option?.correct) return 'right'
  return chosen.value.includes(i) ? 'wrong' : 'dim'
}

/** The words under a checked option; `hidden` is for screen readers only. */
function tagOf(i: number): { text: string; hidden: string } | undefined {
  if (!checked.value) return undefined
  const correct = question.value?.options[i]?.correct
  if (chosen.value.includes(i))
    return { text: 'Your answer', hidden: correct ? ', right' : ', wrong' }
  if (!correct) return undefined
  return { text: 'Right answer', hidden: question.value?.multiple ? ', not chosen' : '' }
}

function onSubmit() {
  const current = question.value
  if (!current) return
  if (!checked.value) {
    if (chosen.value.length === 0) {
      needAnswer.value = true
      return
    }
    needAnswer.value = false
    // Right only on an exact match: every right option chosen, and nothing else.
    answers.value[index.value] = current.options.every(
      (option, i) => option.correct === chosen.value.includes(i),
    )
    checked.value = true
    // The options are now disabled; keep focus on the button, which now says Next.
    void nextTick(() => submit.value?.focus())
    return
  }
  if (!isLast.value) {
    index.value++
    clearAnswer()
    showQuestion()
    return
  }
  // Only a finished attempt is saved.
  store.recordQuiz(quizPath.value, score.value, total.value)
  finished.value = true
  void nextTick(() => {
    window.scrollTo(0, 0)
    resultHeading.value?.focus({ preventScroll: true })
  })
}

function retake() {
  start()
  showQuestion()
}

const percent = computed(() => (total.value ? Math.round((score.value / total.value) * 100) : 0))
const RING = 2 * Math.PI * 52
const verdict = computed(() => {
  if (score.value === total.value) return 'Full marks'
  if (percent.value >= 80) return 'Good work'
  if (percent.value >= 50) return 'Getting there'
  return 'Worth another read'
})
const missed = computed(() => questions.value.filter((_, i) => answers.value[i] === false))

function resetScore() {
  const removed = store.resetQuiz(quizPath.value)
  if (!removed) return
  // The Reset button disappears, so focus goes to Undo.
  showToast({
    message: 'Quiz score reset',
    duration: 6000,
    focusAction: true,
    action: {
      label: 'Undo',
      run: () => {
        store.restore({
          path: design.value?.path ?? quizPath.value,
          quizPath: quizPath.value,
          quiz: removed,
        })
        void nextTick(() => resetButton.value?.focus())
      },
    },
  })
}
</script>

<template>
  <div class="quiz book-callouts">
    <div class="top">
      <a v-if="design" class="back" :href="withBase(design.link)">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
        {{ design.label }}
      </a>
      <span v-if="finished" class="where">Quiz finished</span>
      <span v-else class="where" aria-hidden="true">Question {{ index + 1 }} of {{ total }}</span>
    </div>

    <form v-if="!finished && question" class="ask" @submit.prevent="onSubmit">
      <progress
        class="book-bar"
        :max="total"
        :value="index + 1"
        :aria-label="`Question ${index + 1} of ${total}`"
      />
      <div class="body">
        <div class="eyebrow">
          <h1 class="quiz-title">{{ quiz.title }}</h1>
          <span v-if="answers.length > 0"> · {{ score }} correct so far</span>
        </div>
        <fieldset :key="index" :disabled="checked" :class="{ waiting: !ready }">
          <legend>
            <h2 ref="heading" class="question" tabindex="-1">
              <span class="visually-hidden">Question {{ index + 1 }} of {{ total }}: </span>
              <!-- eslint-disable-next-line vue/no-v-html -- built from our quiz.md, see the top -->
              <span v-html="question.html" />
            </h2>
          </legend>
          <p v-if="question.multiple" class="hint">Choose all that apply.</p>
          <div class="options">
            <label
              v-for="i in order"
              :key="i"
              :for="`answer-${index}-${i}`"
              class="option"
              :class="optionState(i)"
            >
              <input
                :id="`answer-${index}-${i}`"
                class="input"
                :type="question.multiple ? 'checkbox' : 'radio'"
                :name="`answer-${index}`"
                :value="i"
                :checked="chosen.includes(i)"
                @change="choose(i, $event)"
              />
              <span class="mark" :class="{ square: question.multiple }" aria-hidden="true">
                <svg
                  v-if="optionState(i).startsWith('right')"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m5 12 5 5 9-10" />
                </svg>
                <svg
                  v-else-if="optionState(i) === 'wrong'"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </span>
              <span class="option-text">
                <!-- eslint-disable-next-line vue/no-v-html -- built from our quiz.md, see the top -->
                <span v-html="question.options[i]?.html" />
                <span v-if="tagOf(i)" class="tag">
                  {{ tagOf(i)?.text }}<span class="visually-hidden">{{ tagOf(i)?.hidden }}</span>
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <!-- Always in the page, so screen readers announce what appears in it. -->
        <div role="status">
          <p v-if="needAnswer" class="need">Choose an answer first.</p>
          <!-- The site's callouts: Tip for a right answer, Warning for a wrong one. -->
          <div
            v-if="checked"
            class="feedback custom-block github-alert"
            :class="isRight ? 'tip quiz-right' : 'warning'"
          >
            <p class="custom-block-title">{{ isRight ? 'Right' : 'Not quite' }}</p>
            <!-- eslint-disable-next-line vue/no-v-html -- built from our quiz.md, see the top -->
            <div class="explanation" v-html="question.explanation" />
            <a class="review" :href="withBase(question.review.link)">
              Review: {{ question.review.text }}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div class="bar">
        <button ref="submit" type="submit" class="primary">
          <template v-if="!checked">Check</template>
          <template v-else-if="isLast">See your score</template>
          <template v-else>
            Next question
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </template>
        </button>
      </div>
    </form>

    <div v-else-if="finished" class="result">
      <div class="body">
        <h1 class="visually-hidden">{{ quiz.title }}</h1>
        <div class="summary">
          <svg
            class="ring"
            width="120"
            height="120"
            viewBox="0 0 120 120"
            role="img"
            :aria-label="`Score ${score} out of ${total}, ${percent} percent`"
          >
            <circle class="ring-track" cx="60" cy="60" r="52" fill="none" stroke-width="10" />
            <circle
              v-if="score > 0"
              class="ring-value"
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke-width="10"
              stroke-linecap="round"
              :stroke-dasharray="`${(score / total) * RING} ${RING}`"
              transform="rotate(-90 60 60)"
            />
            <text class="ring-score" x="60" y="58" text-anchor="middle">
              {{ score }}/{{ total }}
            </text>
            <text class="ring-percent" x="60" y="80" text-anchor="middle">{{ percent }}%</text>
          </svg>
          <div class="summary-text">
            <h2 ref="resultHeading" class="verdict-title" tabindex="-1">{{ verdict }}</h2>
            <template v-if="saved">
              <span>Best score: {{ saved.best.score }} / {{ saved.best.total }}</span>
              <span>Attempt {{ saved.attempts }}</span>
            </template>
          </div>
        </div>

        <section v-if="missed.length > 0" class="missed" aria-labelledby="missed-title">
          <h3 id="missed-title" class="missed-title">
            Review what you missed ({{ missed.length }})
          </h3>
          <ul class="missed-list">
            <li v-for="item in missed" :key="item.number">
              <a class="missed-link" :href="withBase(item.review.link)">
                <span class="missed-text">
                  <span class="missed-question">{{ item.text }}</span>
                  <span class="missed-section">{{ item.review.text }}</span>
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </a>
            </li>
          </ul>
        </section>
      </div>

      <div class="bar">
        <button type="button" class="primary" @click="retake">Retake the quiz</button>
        <div class="bar-row">
          <a v-if="design" class="secondary" :href="withBase(design.link)">Back to the design</a>
          <button v-if="saved" ref="resetButton" type="button" class="outline" @click="resetScore">
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
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Reset score
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz {
  --scale: var(--book-text-scale, 1);
  max-width: 640px;
  margin: 0 auto;
  padding: 8px 0 0;
  color: var(--vp-c-text-1);
}

/* On phones the quiz fills the screen, so the button bar sits at the bottom as in an app. */
@media (max-width: 767px) {
  .quiz {
    display: flex;
    flex-direction: column;
    min-height: calc(100dvh - var(--vp-nav-height));
  }

  .ask,
  .result {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .ask .bar,
  .result .bar {
    margin-top: auto;
  }
}

.top {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 56px;
  padding: 0 12px 0 4px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
}

.back:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.where {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.ask .book-bar {
  border-radius: 0;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px;
}

.eyebrow {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

/* The page's heading, kept small: the question is what the reader looks at. */
.quiz-title {
  display: inline;
  margin: 0;
  font: inherit;
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  padding: 0;
}

.question {
  margin: 0 0 16px;
  padding: 0;
  border: 0;
  font-family: var(--book-font-display);
  font-size: calc(23px * var(--scale));
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.question:focus {
  outline: none;
}

.hint {
  margin: -6px 0 12px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  font-size: calc(15px * var(--scale));
  line-height: 1.5;
  cursor: pointer;
}

fieldset:not(:disabled) .option:hover {
  border-color: var(--vp-c-brand-1);
}

.option:has(.input:focus-visible) {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

/* The real input sits under the drawn mark; the label makes the whole card clickable. */
.input {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 22px;
  height: 22px;
  margin: 0;
  opacity: 0;
}

.mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 1.5px solid var(--vp-c-text-3);
  border-radius: 999px;
  color: #fff;
}

.mark.square {
  border-radius: 6px;
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag {
  font-size: 13px;
  font-weight: 600;
}

/* Thicker border with 1 px less padding, so the text doesn't move. */
.option.selected,
.option.right,
.option.wrong {
  padding: 12px;
  border-width: 2px;
}

.option.selected {
  border-color: var(--vp-c-brand-1);
}

.option.selected .mark {
  border-color: var(--vp-c-brand-1);
  background: radial-gradient(circle, var(--vp-c-brand-1) 45%, transparent 50%);
}

.option.selected .mark.square {
  background: var(--vp-c-brand-1);
}

fieldset:disabled .option {
  cursor: default;
}

.option.right {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.option.right .mark {
  border: 0;
  color: var(--book-on-right);
  background: var(--vp-c-brand-1);
}

.option.not-chosen .mark {
  border: 1.5px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: none;
}

.option.right .tag {
  color: var(--vp-c-brand-1);
}

.option.wrong {
  border-color: var(--book-wrong);
  background: var(--book-wrong-soft);
}

.option.wrong .mark {
  border: 0;
  background: var(--book-wrong);
}

.option.wrong .tag {
  color: var(--book-danger);
}

.option.dim {
  color: var(--vp-c-text-2);
}

.need {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--book-danger);
}

.feedback {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 14px 16px;
}

.feedback .custom-block-title {
  margin: 0;
}

.explanation {
  font-size: calc(15px * var(--scale));
  line-height: 1.55;
  color: var(--vp-c-text-1);
}

.explanation :deep(p) {
  margin: 0;
}

.explanation :deep(p + p) {
  margin-top: 8px;
}

.explanation :deep(code),
.option-text :deep(code),
.question :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.875em;
  background: var(--vp-c-default-soft);
}

.review {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.review:hover {
  text-decoration: underline;
}

/* Stays at the bottom of the screen, so the button is in reach after a long explanation. */
.bar {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 20px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.bar-row {
  display: flex;
  gap: 10px;
}

.primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  border-radius: 12px;
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  font-size: 16px;
  font-weight: 600;
}

.primary:hover {
  background: var(--vp-button-brand-hover-bg);
}

.secondary {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border-radius: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
}

.secondary:hover {
  background: var(--vp-c-default-2);
}

.outline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-2);
  font-size: 15px;
  font-weight: 600;
}

.outline:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.back:focus-visible,
.review:focus-visible,
.primary:focus-visible,
.secondary:focus-visible,
.outline:focus-visible,
.missed-link:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.result .body {
  gap: 20px;
}

.summary {
  display: flex;
  align-items: center;
  gap: 20px;
}

.ring {
  flex: none;
}

.ring-track {
  stroke: var(--vp-c-default-soft);
}

.ring-value {
  stroke: var(--vp-c-brand-1);
}

.ring-score {
  font-family: var(--book-font-display);
  font-size: 28px;
  font-weight: 700;
  fill: var(--vp-c-text-1);
}

.ring-percent {
  font-size: 14px;
  fill: var(--vp-c-text-2);
}

.summary-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.verdict-title {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: var(--book-font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--vp-c-text-1);
}

.verdict-title:focus {
  outline: none;
}

.missed {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.missed-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.missed-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.missed-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.missed-link:hover {
  border-color: var(--vp-c-brand-1);
}

.missed-link svg {
  flex: none;
  color: var(--vp-c-text-2);
}

.missed-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.missed-question {
  font-size: 15px;
  font-weight: 500;
}

.missed-section {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.waiting {
  visibility: hidden;
}

/* Windows high contrast replaces our colours, so draw the marks in system colours. */
@media (forced-colors: active) {
  .option.selected .mark,
  .option.selected .mark.square,
  .option.right .mark,
  .option.wrong .mark {
    border: 2px solid CanvasText;
    color: CanvasText;
    background: Canvas;
  }

  .option.selected .mark {
    background: radial-gradient(circle, Highlight 45%, Canvas 50%);
  }

  .option.selected .mark.square {
    background: Highlight;
  }

  .option.selected {
    border-color: Highlight;
  }
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
