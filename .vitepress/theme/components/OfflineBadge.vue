<script setup lang="ts">
import { availableOffline } from '../pwa.ts'

defineProps<{ place: 'bar' | 'menu' }>()
</script>

<template>
  <div v-if="availableOffline" class="offline" :class="place">
    <p class="badge" title="Available offline">
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
        <path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18Z" />
        <path d="m9.5 13 2 2 3.5-3.5" />
      </svg>
      <span class="label">Available offline</span>
    </p>
  </div>
</template>

<style scoped>
.offline {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.menu {
  margin-top: 16px;
}

/* In the bar it follows the section links (style.css orders them first): the icon alone from
   1100 px, the words from 1280 px. Below 1100 px the links leave no room; below 960 px the
   menu has it instead. */
.bar {
  display: none;
  order: -1;
}

@media (min-width: 1100px) {
  .bar {
    display: flex;
  }

  .bar .badge {
    padding: 6px;
  }

  .bar .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
}

@media (min-width: 1280px) {
  .bar {
    margin-right: 12px;
  }

  .bar .badge {
    padding: 4px 10px;
  }

  .bar .label {
    position: static;
    width: auto;
    height: auto;
    clip-path: none;
  }

  /* The same divider VitePress puts before the theme toggle, which then drops its own. */
  .bar::before {
    width: 1px;
    height: 24px;
    margin: 0 16px 0 8px;
    background: var(--vp-c-divider);
    content: '';
  }
}
</style>
