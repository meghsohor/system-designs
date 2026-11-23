<script setup lang="ts">
import { useRoute } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  block,
  blocks,
  close,
  ended,
  index,
  loadingVoices,
  next,
  open,
  pause,
  play,
  playing,
  previous,
  problem,
  sentence,
  setSpeed,
  setVoice,
  speed,
  voice,
  voices,
  voicesReady,
} from '../listen/player.ts'
import { SPEEDS, voiceLabels } from '../listen/voices.ts'

// The listening player: a floating bar under the text from 640 px, a bottom sheet on phones.
const route = useRoute()
// A <button> inside a <select> is the styled menu's face. Vue's template check predates styled
// selects and warns about it; naming the tag at runtime skips that check.
const TRIGGER = 'button'

const root = ref<HTMLElement>()
const playButton = ref<HTMLButtonElement>()

const labels = computed(() => voiceLabels(voices.value))
const localVoices = computed(() => voices.value.filter((v) => v.localService))
const onlineVoices = computed(() => voices.value.filter((v) => !v.localService))
const noVoices = computed(() => voicesReady.value && voices.value.length === 0)

const status = computed(() => {
  if (problem.value) return problem.value
  if (loadingVoices.value) return 'Loading voices…'
  if (ended.value) return 'End of the page'
  return sentence.value
})
const section = computed(() => (ended.value ? '' : (block.value?.section ?? '')))
const voiceNote = computed(() => {
  const current = voice.value
  if (!current) return ''
  const where = current.localService ? 'on this device, works offline' : 'needs internet'
  return `Voice: ${labels.value.get(current) ?? current.name} · ${where}`
})

function stop() {
  close()
  document.querySelector<HTMLButtonElement>('.listen-button')?.focus({ preventScroll: true })
}

const onSpeed = (event: Event) => setSpeed(Number((event.target as HTMLSelectElement).value))
const onVoice = (event: Event) => setVoice((event.target as HTMLSelectElement).value)

// Toasts move up above the player; the page gets room at the end so nothing hides behind it.
let observer: ResizeObserver | undefined
function measure() {
  const el = root.value
  const style = document.documentElement.style
  if (!el) {
    style.removeProperty('--listen-player-space')
    return
  }
  const sheet = getComputedStyle(el).position === 'fixed'
  style.setProperty('--listen-player-space', `${el.offsetHeight + (sheet ? 0 : 24)}px`)
  document.documentElement.classList.toggle('listen-sheet-open', sheet)
}

watch(root, (el) => {
  observer?.disconnect()
  if (el) {
    observer = new ResizeObserver(measure)
    observer.observe(el)
    void nextTick(() => playButton.value?.focus({ preventScroll: true }))
  } else {
    document.documentElement.classList.remove('listen-sheet-open')
  }
  measure()
})

watch(() => route.path, close)
onBeforeUnmount(() => {
  observer?.disconnect()
  close()
  document.documentElement.style.removeProperty('--listen-player-space')
  document.documentElement.classList.remove('listen-sheet-open')
})
</script>

<template>
  <section
    v-if="open"
    id="listen-player"
    ref="root"
    class="listen-player"
    aria-label="Listening player"
  >
    <button
      type="button"
      class="icon prev"
      aria-label="Previous paragraph"
      :disabled="index === 0 || noVoices"
      @click="previous"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 6 10 12l8 6z" />
        <path d="M6 6v12" />
      </svg>
    </button>
    <button
      ref="playButton"
      type="button"
      class="play"
      :aria-label="playing ? 'Pause' : 'Play'"
      :disabled="noVoices || loadingVoices"
      @click="playing ? pause() : play()"
    >
      <svg v-if="playing" viewBox="0 0 24 24" class="filled" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
      <svg v-else viewBox="0 0 24 24" class="filled" aria-hidden="true">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
      </svg>
    </button>
    <button
      type="button"
      class="icon next"
      aria-label="Next paragraph"
      :disabled="index >= blocks.length - 1 || noVoices"
      @click="next"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 6 8 6-8 6z" />
        <path d="M18 6v12" />
      </svg>
    </button>

    <div class="info">
      <p class="head">
        <span class="label">Now reading</span>
        <span v-if="section" class="where">
          <span class="dot" aria-hidden="true">·</span>{{ section }}
          <span class="count">· paragraph {{ index + 1 }} of {{ blocks.length }}</span>
        </span>
      </p>
      <p class="text" :class="{ problem }" :role="problem ? 'status' : undefined">{{ status }}</p>
    </div>

    <progress
      class="bar book-bar"
      aria-label="Place in the page"
      :max="blocks.length"
      :value="ended ? blocks.length : index + 1"
    />

    <!-- Where the browser can style a select, the trigger button is what shows; others ignore it. -->
    <select
      class="speed chip"
      aria-label="Speed"
      :value="speed"
      :disabled="noVoices"
      @change="onSpeed"
    >
      <component :is="TRIGGER" type="button" class="trigger"><selectedcontent /></component>
      <option v-for="s in SPEEDS" :key="s" :value="s">{{ s }}×</option>
    </select>

    <span class="voice chip">
      <svg class="mic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
        <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
      </svg>
      <select aria-label="Voice" :value="voice?.voiceURI" :disabled="noVoices" @change="onVoice">
        <component :is="TRIGGER" type="button" class="trigger">
          <svg class="mic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
          </svg>
          <selectedcontent />
        </component>
        <option v-if="noVoices" value="">No voices</option>
        <optgroup v-if="localVoices.length" label="On this device">
          <option v-for="v in localVoices" :key="v.voiceURI" :value="v.voiceURI">
            {{ labels.get(v) }}
          </option>
        </optgroup>
        <optgroup v-if="onlineVoices.length" label="Needs internet">
          <option v-for="v in onlineVoices" :key="v.voiceURI" :value="v.voiceURI">
            {{ labels.get(v) }}
          </option>
        </optgroup>
      </select>
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </span>

    <button type="button" class="icon close" aria-label="Stop listening" @click="stop">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>

    <p v-if="voiceNote" class="note">{{ voiceNote }}</p>
  </section>
</template>

<style scoped>
/* Phones: a bottom sheet. */
.listen-player {
  position: fixed;
  inset: auto 0 0;
  z-index: 25;
  display: grid;
  grid-template-columns: 56px 1fr 48px 64px 48px 1fr 56px;
  grid-template-areas:
    'head head head head head head close'
    'text text text text text text text'
    'bar bar bar bar bar bar bar'
    'speed . prev play next . voice'
    'note note note note note note note';
  align-items: center;
  row-gap: 12px;
  box-sizing: border-box;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--vp-c-divider);
  border-radius: 18px 18px 0 0;
  background: var(--vp-c-bg-elv);
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.14);
  color: var(--vp-c-text-1);
}

.dark .listen-player {
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.35);
}

.prev {
  grid-area: prev;
}

.play {
  grid-area: play;
}

.next {
  grid-area: next;
}

.close {
  grid-area: close;
  justify-self: end;
  margin: -6px -6px -6px 0;
}

.info {
  display: contents;
}

.head {
  grid-area: head;
  display: flex;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.label {
  flex: none;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.where {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--vp-c-text-2);
}

.dot {
  display: none;
  margin: 0 4px;
}

.text {
  grid-area: text;
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
}

.text.problem {
  color: var(--vp-c-text-2);
  font-weight: 400;
}

.bar {
  grid-area: bar;
}

.note {
  grid-area: note;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  color: var(--vp-c-text-2);
}

button {
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--vp-c-text-1);
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

button svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

button svg.filled {
  fill: currentColor;
  stroke: none;
}

.icon {
  width: 48px;
  height: 48px;
  border-radius: 999px;
}

.icon:not(:disabled):hover {
  background: var(--vp-c-default-soft);
}

.close {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
}

.close svg {
  width: 18px;
  height: 18px;
}

.play {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  transition: background-color 0.2s;
}

.play svg {
  width: 26px;
  height: 26px;
}

.play:not(:disabled):hover {
  background: var(--vp-button-brand-hover-bg);
}

select {
  font: inherit;
  color: var(--vp-c-text-1);
}

.chip {
  box-sizing: border-box;
  height: 44px;
  border: 0;
  border-radius: 999px;
  background: var(--listen-chip);
  box-shadow:
    inset 0 1px 0 var(--listen-chip-edge),
    0 1px 2px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: background-color 0.15s;
}

.chip:not(:disabled, :has(select:disabled)):hover {
  background: var(--listen-chip-hover);
}

.speed {
  grid-area: speed;
  width: 56px;
  padding: 0;
  appearance: none;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  /* 16 px, or iOS zooms the page when the menu opens. */
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  text-align-last: center;
}

.speed:not(:disabled):hover {
  background: color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent);
}

.voice {
  grid-area: voice;
  position: relative;
  display: grid;
  place-items: center;
  width: 56px;
}

.voice svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The menu covers the microphone icon, so a tap opens the device's own voice picker. */
.voice select {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  font-size: 16px;
  cursor: pointer;
}

.voice:has(select:disabled),
.speed:disabled {
  opacity: 0.4;
  cursor: default;
}

.voice .chevron,
.trigger .mic {
  display: none;
}

.voice:has(select:focus-visible),
.speed:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

select:disabled {
  cursor: default;
}

/* Firefox draws its own menu in the select's colours; keep the list solid and readable. */
@supports not (appearance: base-select) {
  option,
  optgroup {
    background: var(--listen-menu);
    color: var(--vp-c-text-1);
  }
}

/* Chrome, Edge and Safari 27 let the menus themselves be styled: a floating card with a tick on
   the chosen item. Elsewhere the chips stay and the device opens its own menu. */
@supports (appearance: base-select) {
  .speed,
  .voice select,
  .speed::picker(select),
  .voice select::picker(select) {
    appearance: base-select;
  }

  .voice > .mic,
  .voice > .chevron {
    display: none;
  }

  .speed {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .voice select {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    opacity: 1;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: inherit;
  }

  .trigger .mic {
    display: block;
  }

  .voice selectedcontent,
  .speed::picker-icon,
  .voice select::picker-icon {
    display: none;
  }

  .speed::picker(select),
  .voice select::picker(select) {
    min-width: 200px;
    margin: 8px 0;
    padding: 6px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 14px;
    background: var(--listen-menu);
    box-shadow: var(--listen-menu-shadow);
    color: var(--vp-c-text-1);
    opacity: 0;
    translate: 0 6px;
    transition:
      opacity 0.16s ease,
      translate 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
      overlay 0.18s allow-discrete,
      display 0.18s allow-discrete;
  }

  .speed::picker(select) {
    min-width: 120px;
  }

  /* Some devices list dozens of voices; the card scrolls instead of filling the window. */
  .voice select::picker(select) {
    max-height: min(420px, 60vh);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .speed:open::picker(select),
  .voice select:open::picker(select) {
    opacity: 1;
    translate: 0 0;
  }

  @starting-style {
    .speed:open::picker(select),
    .voice select:open::picker(select) {
      opacity: 0;
      translate: 0 6px;
    }
  }

  option {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 6px 10px;
    border-radius: 8px;
    color: var(--vp-c-text-1);
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  option:hover,
  option:focus-visible {
    background: var(--vp-c-brand-soft);
  }

  option:checked {
    color: var(--vp-c-brand-1);
    font-weight: 600;
  }

  option::checkmark {
    order: 1;
    margin-left: auto;
    content: '';
    width: 16px;
    height: 16px;
    background: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12 5 5 9-10'/%3E%3C/svg%3E")
      center / contain no-repeat;
  }

  optgroup {
    padding: 8px 10px 4px;
    color: var(--vp-c-text-2);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  optgroup + optgroup {
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--vp-c-divider);
  }

  optgroup option {
    letter-spacing: 0;
    text-transform: none;
  }
}

/* From 640 px: a floating bar that stays under the text column. */
@media (min-width: 640px) {
  .listen-player {
    position: sticky;
    bottom: 24px;
    inset-inline: auto;
    z-index: 10;
    grid-template-columns: auto auto auto minmax(0, 1fr) auto auto auto;
    grid-template-areas: 'prev play next info speed voice close';
    column-gap: 6px;
    margin: 32px -12px 0;
    padding: 10px 12px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 16px;
    box-shadow:
      0 12px 32px rgba(15, 23, 42, 0.14),
      0 2px 6px rgba(15, 23, 42, 0.06);
  }

  .dark .listen-player {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }

  .icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }

  .icon svg {
    width: 20px;
    height: 20px;
  }

  .play {
    width: 48px;
    height: 48px;
  }

  .play svg {
    width: 20px;
    height: 20px;
  }

  .close {
    width: 44px;
    height: 44px;
    margin: 0;
  }

  .info {
    grid-area: info;
    display: block;
    min-width: 0;
    padding: 0 8px;
  }

  .head {
    gap: 0;
    font-size: 12px;
    line-height: 1.35;
  }

  .label {
    font-weight: 400;
    color: var(--vp-c-text-2);
  }

  .dot {
    display: inline;
  }

  .count,
  .bar,
  .note {
    display: none;
  }

  .text {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    line-height: 1.35;
  }

  .chip {
    height: 36px;
  }

  .speed {
    width: auto;
    min-width: 56px;
    padding: 0 12px;
    font-size: 13px;
  }

  .voice {
    width: auto;
    max-width: 190px;
  }

  .voice > .mic {
    display: none;
  }

  .voice select {
    position: static;
    height: 100%;
    padding: 0 30px 0 14px;
    border: 0;
    appearance: none;
    background: transparent;
    opacity: 1;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
  }

  .voice > .chevron {
    display: block;
    position: absolute;
    right: 11px;
    width: 14px;
    height: 14px;
    color: var(--vp-c-text-2);
    pointer-events: none;
  }

  @supports (appearance: base-select) {
    .voice select {
      padding: 0 12px 0 14px;
      appearance: base-select;
    }

    .voice > .chevron,
    .trigger .mic {
      display: none;
    }

    .voice selectedcontent {
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .voice select::picker-icon {
      display: block;
      content: '';
      width: 14px;
      height: 14px;
      margin-left: 6px;
      background: var(--vp-c-text-2);
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
        center / contain no-repeat;
      transition: rotate 0.2s;
    }

    .voice select:open::picker-icon {
      rotate: 180deg;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .speed::picker(select),
  .voice select::picker(select),
  .voice select::picker-icon {
    translate: none;
    transition: none;
  }
}
</style>
