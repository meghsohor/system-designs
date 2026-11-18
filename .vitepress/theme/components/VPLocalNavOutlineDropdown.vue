<script setup lang="ts">
// Our copy of VitePress 1.6.4's VPLocalNavOutlineDropdown.vue, swapped in by an alias in the
// config. Change: on written pages the button shows how far through the page the reader is
// (a ring and a percentage). Recheck it when upgrading VitePress.
import { onKeyStroke } from '@vueuse/core'
import { onContentUpdated, useData } from 'vitepress'
import { computed, nextTick, ref, watch } from 'vue'
import { liveFraction } from '../progress/live.ts'
import VPDocOutlineItem from './VPDocOutlineItem.vue'

interface MenuItem {
  title: string
  link: string
  children?: MenuItem[]
}

const props = defineProps<{
  headers: MenuItem[]
  navHeight: number
}>()

const { theme } = useData()
const open = ref(false)
const vh = ref(0)
const main = ref<HTMLDivElement>()
const items = ref<HTMLDivElement>()

const title = computed(() => {
  const outline = theme.value.outline
  return (
    (typeof outline === 'object' && !Array.isArray(outline) && outline.label) ||
    theme.value.outlineTitle ||
    'On this page'
  )
})
const topLabel = computed(() => theme.value.returnToTopLabel || 'Return to top')

// Ring circumference for r = 7.
const RING = 2 * Math.PI * 7
const percent = computed(() =>
  liveFraction.value === undefined ? undefined : Math.round(liveFraction.value * 100),
)

function closeOnClickOutside(e: Event) {
  if (!main.value?.contains(e.target as Node)) {
    open.value = false
  }
}

watch(open, (value) => {
  if (value) {
    document.addEventListener('click', closeOnClickOutside)
    return
  }
  document.removeEventListener('click', closeOnClickOutside)
})

onKeyStroke('Escape', () => {
  open.value = false
})

onContentUpdated(() => {
  open.value = false
})

function toggle() {
  open.value = !open.value
  vh.value = window.innerHeight + Math.min(window.scrollY - props.navHeight, 0)
}

function onItemClick(e: Event) {
  if ((e.target as HTMLElement).closest('.outline-link')) {
    // disable animation on hash navigation when page jumps
    if (items.value) {
      items.value.style.transition = 'none'
    }
    nextTick(() => {
      open.value = false
    })
  }
}

function scrollToTop() {
  open.value = false
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}
</script>

<template>
  <div ref="main" class="VPLocalNavOutlineDropdown" :style="{ '--vp-vh': vh + 'px' }">
    <button v-if="headers.length > 0" :class="{ open }" @click="toggle">
      <span v-if="percent !== undefined" class="progress">
        <svg class="ring" viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
          <circle class="track" cx="9" cy="9" r="7" />
          <circle
            class="fill"
            cx="9"
            cy="9"
            r="7"
            :stroke-dasharray="RING"
            :stroke-dashoffset="RING * (1 - percent / 100)"
          />
        </svg>
        <span class="percent">{{ percent }}%</span>
        <span class="visually-hidden">read,</span>
      </span>
      <span class="menu-text">{{ title }}</span>
      <span class="vpi-chevron-right icon" />
    </button>
    <button v-else @click="scrollToTop">
      {{ topLabel }}
    </button>
    <Transition name="flyout">
      <!-- Closes the list after a link in it is used; the links themselves take the keyboard. -->
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div v-if="open" ref="items" class="items" @click="onItemClick">
        <div class="header">
          <a class="top-link" href="#" @click="scrollToTop">
            {{ topLabel }}
          </a>
        </div>
        <div class="outline">
          <VPDocOutlineItem :headers="headers" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.VPLocalNavOutlineDropdown {
  padding: 12px 20px 11px;
}

@media (min-width: 960px) {
  .VPLocalNavOutlineDropdown {
    padding: 12px 36px 11px;
  }
}

.VPLocalNavOutlineDropdown button {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 24px;
  color: var(--vp-c-text-2);
  transition: color 0.5s;
  position: relative;
}

.VPLocalNavOutlineDropdown button:hover {
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.VPLocalNavOutlineDropdown button.open {
  color: var(--vp-c-text-1);
}

.icon {
  display: inline-block;
  vertical-align: middle;
  margin-left: 2px;
  font-size: 14px;
  transform: rotate(0) /*rtl:rotate(180deg)*/;
  transition: transform 0.25s;
}

@media (min-width: 960px) {
  .VPLocalNavOutlineDropdown button {
    font-size: 14px;
  }

  .icon {
    font-size: 16px;
  }
}

.open > .icon {
  /*rtl:ignore*/
  transform: rotate(90deg);
}

.items {
  position: absolute;
  top: 40px;
  right: 16px;
  left: 16px;
  display: grid;
  gap: 1px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background-color: var(--vp-c-gutter);
  max-height: calc(var(--vp-vh, 100vh) - 86px);
  overflow: hidden auto;
  box-shadow: var(--vp-shadow-3);
}

@media (min-width: 960px) {
  .items {
    right: auto;
    left: calc(var(--vp-sidebar-width) + 32px);
    width: 320px;
  }
}

.header {
  background-color: var(--vp-c-bg-soft);
}

.top-link {
  display: block;
  padding: 0 16px;
  line-height: 48px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.outline {
  /* A grid item: without this, long titles widen the list past the screen. */
  min-width: 0;
  padding: 8px 0;
  background-color: var(--vp-c-bg-soft);
}

.flyout-enter-active {
  transition: all 0.2s ease-out;
}

.flyout-leave-active {
  transition: all 0.15s ease-in;
}

.flyout-enter-from,
.flyout-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}

/* Reading progress, before "On this page". */
.progress {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 8px;
  vertical-align: middle;
}

.ring {
  transform: rotate(-90deg);
}

.ring circle {
  fill: none;
  stroke-width: 2.5;
}

.ring .track {
  stroke: var(--vp-c-divider);
}

.ring .fill {
  stroke: var(--vp-c-brand-1);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.2s;
}

.percent {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .ring .fill {
    transition: none;
  }
}
</style>
