<script setup lang="ts">
import { useRoute } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { noteScrollbar } from '../scrollbar.ts'

// Below 75% of natural size a diagram's labels are under 12 px; above 2× it only gets blurry.
const READABLE = 0.75
const MAX = 2

const dialog = ref<HTMLDialogElement>()
const body = ref<HTMLElement>()
const picture = ref<HTMLImageElement>()
const src = ref('')
const alt = ref('')
const caption = ref('')
const width = ref<number>()
// The width the picture is drawn for (an SVG's viewBox), which a 2× export doubles.
let baseWidth = 0
let opener: HTMLElement | null = null

// Fill the card, but never below the readable size: then the card scrolls instead.
function fit() {
  const img = picture.value
  const box = body.value
  if (!img?.naturalWidth || !img.naturalHeight || !box) return
  const style = getComputedStyle(box)
  const w = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const h = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  const base = baseWidth || img.naturalWidth
  const fitWidth = Math.min(w, (h * img.naturalWidth) / img.naturalHeight)
  width.value = Math.round(Math.max(base * READABLE, Math.min(fitWidth, base * MAX)))
}

function open(figure: Element) {
  const img = figure.querySelector('img')
  if (!img || !dialog.value) return
  src.value = img.currentSrc || img.src
  alt.value = img.alt
  caption.value = figure.querySelector('.figure-caption')?.textContent ?? ''
  baseWidth = Number(img.dataset.baseWidth) || 0
  // Clicking the picture focuses nothing, so focus goes back to the zoom button.
  opener = figure.querySelector<HTMLElement>('.zoom-button')
  width.value = undefined
  noteScrollbar()
  dialog.value.showModal()
  // A cached image may not fire load again.
  void nextTick(fit)
}

function onPageClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  const trigger = event.target.closest('.vp-doc .zoom-button, .vp-doc .figure > img')
  const figure = trigger?.closest('.figure')
  if (figure) open(figure)
}

function onResize() {
  if (dialog.value?.open) fit()
}

function onClose() {
  src.value = ''
  opener?.focus({ preventScroll: true })
  opener = null
}

// Back (or any navigation) while open would leave the popup over the next page.
const route = useRoute()
watch(
  () => route.path,
  () => dialog.value?.close(),
)

// The card fills the dialog, so a click on the dialog itself is a click on the backdrop.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value.close()
}

onMounted(() => {
  document.addEventListener('click', onPageClick)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onPageClick)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <!-- Esc closes a modal dialog natively; the click handler only adds closing on the backdrop. -->
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <dialog
    ref="dialog"
    class="zoom-dialog"
    :aria-label="caption || alt || 'Image'"
    @click="onDialogClick"
    @close="onClose"
  >
    <div class="card">
      <div class="header">
        <p class="caption">{{ caption }}</p>
        <button type="button" class="close" aria-label="Close" @click="dialog?.close()">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <!-- Focusable so arrow keys scroll a picture larger than the card. -->
      <!-- eslint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -->
      <div ref="body" class="body" tabindex="0">
        <img
          v-if="src"
          ref="picture"
          :src="src"
          :alt="alt"
          :class="{ sized: width }"
          :style="width ? { width: `${width}px` } : undefined"
          @load="fit"
        />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.zoom-dialog {
  width: min(1400px, calc(100vw - 32px));
  height: calc(100dvh - 32px);
  max-width: none;
  max-height: none;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.zoom-dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
}

.card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 4px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.caption {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--vp-c-text-2);
}

.close:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

/* Auto margins centre a small picture and fall to 0 on a large one, so it can scroll fully. */
.body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.body img {
  flex: none;
  max-width: none;
  height: auto;
  margin: auto;
  visibility: hidden;
}

.body img.sized {
  visibility: visible;
}

.close:focus-visible,
.body:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
</style>
