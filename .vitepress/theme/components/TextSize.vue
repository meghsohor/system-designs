<script setup lang="ts">
import { ref } from 'vue'
import TextSizeControls from './TextSizeControls.vue'

const button = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()

// The panel is placed once, under the button; below 960 px the nav scrolls away, and a resize
// moves the button, so either one closes it rather than leaving it stranded.
function close() {
  panel.value?.hidePopover()
}

// A popover opens in the middle of the screen; put it under the button instead.
function place(event: Event) {
  const opening = (event as ToggleEvent).newState === 'open'
  for (const type of ['scroll', 'resize'] as const) {
    if (opening) window.addEventListener(type, close, { passive: true })
    else window.removeEventListener(type, close)
  }
  if (!opening || !button.value || !panel.value) return
  const rect = button.value.getBoundingClientRect()
  panel.value.style.top = `${rect.bottom + 8}px`
  panel.value.style.right = `${Math.max(document.documentElement.clientWidth - rect.right, 8)}px`
}
</script>

<template>
  <!-- From 768 px; phones get the same controls in the menu (see BookLayout). -->
  <div class="text-size">
    <button
      ref="button"
      type="button"
      class="toggle"
      popovertarget="text-size-panel"
      aria-label="Text size"
      title="Text size"
    >
      <span aria-hidden="true">Aa</span>
    </button>
    <div id="text-size-panel" ref="panel" popover class="panel" @beforetoggle="place">
      <TextSizeControls label-id="text-size-label" />
    </div>
  </div>
</template>

<style scoped>
.text-size {
  display: none;
}

@media (min-width: 768px) {
  .text-size {
    display: flex;
    align-items: center;
  }
}

.toggle {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
  font-size: 15px;
  font-weight: 600;
}

.toggle:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.toggle:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.panel {
  position: fixed;
  inset: auto;
  margin: 0;
  width: 200px;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  box-shadow: var(--vp-shadow-3);
}
</style>
