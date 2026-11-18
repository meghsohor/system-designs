<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { currentToast, hideToast } from '../toast.ts'

const el = ref<HTMLElement>()
const actionButton = ref<HTMLButtonElement>()
let timer: ReturnType<typeof setTimeout> | undefined

// While the pointer or focus is on the toast, it stays (WCAG 2.2.1: enough time to use Undo).
let held = false
function startTimer() {
  clearTimeout(timer)
  const toast = currentToast.value
  if (toast && !held) timer = setTimeout(hideToast, toast.duration)
}
function hold() {
  held = true
  clearTimeout(timer)
}
function release(event: Event) {
  const next = (event as FocusEvent).relatedTarget
  if (next instanceof Node && el.value?.contains(next)) return
  held = false
  startTimer()
}

// A manual popover sits in the top layer, so it shows above the nav and any player.
watch(currentToast, (toast) => {
  clearTimeout(timer)
  const popover = el.value
  if (!popover) return
  if (!toast) {
    if (popover.matches(':popover-open')) popover.hidePopover()
    return
  }
  if (!popover.matches(':popover-open')) popover.showPopover()
  held = false
  startTimer()
  if (toast.focusAction) void nextTick(() => actionButton.value?.focus())
})

function act() {
  const action = currentToast.value?.action
  hideToast()
  action?.run()
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    ref="el"
    popover="manual"
    role="status"
    class="toast"
    @pointerenter="hold"
    @pointerleave="release"
    @focusin="hold"
    @focusout="release"
  >
    <template v-if="currentToast">
      <span class="message">{{ currentToast.message }}</span>
      <button
        v-if="currentToast.action"
        ref="actionButton"
        type="button"
        class="action"
        @click="act"
      >
        {{ currentToast.action.label }}
      </button>
      <button type="button" class="close" aria-label="Dismiss" @click="hideToast">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  inset: auto 16px 24px;
  margin: 0 auto;
  width: fit-content;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  padding: 6px 6px 6px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  box-shadow: var(--vp-shadow-3);
  font-size: 14px;
}

.toast:popover-open {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message {
  padding: 8px 0;
}

.action {
  min-height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.action:hover {
  background: var(--vp-c-default-soft);
}

.close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
}

.close:hover {
  background: var(--vp-c-default-soft);
}

.action:focus-visible,
.close:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
</style>
