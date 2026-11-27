<script setup lang="ts">
// The 16 px status circle next to a page in the sidebar. With no status (progress not loaded
// yet) it's an empty slot of the same size, so nothing shifts or flashes.
defineProps<{ status?: 'done' | 'in-progress' | 'not-started' }>()

const labels = { done: 'Done', 'in-progress': 'In progress', 'not-started': 'Not started' }
</script>

<template>
  <span class="mark">
    <template v-if="status">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" :class="status">
        <template v-if="status === 'done'">
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path
            d="m4.5 8.2 2.3 2.3 4.7-5"
            fill="none"
            stroke="var(--vp-c-bg)"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </template>
        <template v-else-if="status === 'in-progress'">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 3a5 5 0 0 1 0 10z" fill="currentColor" />
        </template>
        <circle v-else cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span class="visually-hidden">{{ labels[status] }}</span>
    </template>
  </span>
</template>

<style scoped>
.mark {
  flex: none;
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.done,
.in-progress {
  color: var(--vp-c-brand-1);
}

.not-started {
  color: var(--vp-c-text-3);
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
