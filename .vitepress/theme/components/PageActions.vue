<script setup lang="ts">
import { useData } from 'vitepress'
import { useProgress } from '../progress/useProgress.ts'

// Inserted under the page title of written pages by a markdown rule (see config).
// Listen, Copy as markdown and the quiz button join it in later tasks.
const { page } = useData()
const { store, loaded, track } = useProgress()
const status = track((s) => s.getPage(page.value.relativePath)?.status)
</script>

<template>
  <div class="page-actions">
    <!-- Nothing progress-related renders until saved progress has loaded, so it never flashes. -->
    <!-- One button for both states, so keyboard focus stays put after marking the page done. -->
    <button
      v-if="loaded"
      type="button"
      class="action"
      :class="{ done: status === 'done' }"
      :aria-disabled="status === 'done'"
      @click="status !== 'done' && store.markDone(page.relativePath)"
    >
      <svg v-if="status === 'done'" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="currentColor" />
        <path
          d="m4.5 8.2 2.3 2.3 4.7-5"
          fill="none"
          stroke="var(--vp-c-bg)"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.8 2.8L16 9.5" />
      </svg>
      {{ status === 'done' ? 'Done' : 'Mark as done' }}
    </button>
  </div>
</template>

<style scoped>
.page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin: 16px 0 8px;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin: 0;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.action {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.action:not(.done):hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.action:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.action.done {
  border-color: transparent;
  color: var(--vp-c-brand-1);
  cursor: default;
}
</style>
