<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { rangeOf, type Block } from '../listen/blocks.ts'
import { block, ended, open } from '../listen/player.ts'

// One tinted box behind the block being read. It slides and resizes to the next block, so the
// eye can follow it; with reduced motion it moves at once.
const box = ref<HTMLElement>()
const shown = ref(false)
let observer: ResizeObserver | undefined

const PAD_X = 10
const PAD_Y = 8
// List markers sit left of the item's box.
const MARKER = 22

function areaOf(current: Block): DOMRect | undefined {
  if (current.tint) return current.el.getBoundingClientRect()
  // Headings and items with a nested list: just their own words.
  return rangeOf(current, 0, current.text.length)?.getBoundingClientRect()
}

function place(withMotion: boolean) {
  const el = box.value
  const current = block.value
  const parent = el?.offsetParent
  const area = current && !ended.value ? areaOf(current) : undefined
  if (!el || !parent || !area || area.height === 0) {
    shown.value = false
    return
  }
  const base = parent.getBoundingClientRect()
  const marker = current?.el.tagName === 'LI' ? MARKER : 0
  // Set straight on the element so it applies to this move, not after Vue's next render.
  el.toggleAttribute('data-motion', withMotion && shown.value)
  el.style.transform = `translate(${area.left - base.left - PAD_X - marker}px, ${area.top - base.top - PAD_Y}px)`
  el.style.width = `${area.width + PAD_X * 2 + marker}px`
  el.style.height = `${area.height + PAD_Y * 2}px`
  shown.value = true
}

watch([block, ended], () => void nextTick(() => place(true)))

watch(open, (isOpen) => {
  observer?.disconnect()
  if (!isOpen) {
    shown.value = false
    return
  }
  // Text size changes, images loading and window resizes move the block without animation.
  // The column re-centres inside .content without changing size, so both are watched.
  observer = new ResizeObserver(() => place(false))
  const doc = document.querySelector('.vp-doc')
  if (doc) observer.observe(doc)
  if (box.value?.offsetParent) observer.observe(box.value.offsetParent)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="box" class="listen-glide" :class="{ shown: open && shown }" aria-hidden="true" />
</template>

<style scoped>
.listen-glide {
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  border-radius: 10px;
  background: var(--listen-block);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.listen-glide.shown {
  opacity: 1;
}

.listen-glide[data-motion] {
  transition:
    opacity 0.2s,
    transform 0.36s cubic-bezier(0.2, 0.8, 0.2, 1),
    width 0.36s cubic-bezier(0.2, 0.8, 0.2, 1),
    height 0.36s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .listen-glide[data-motion] {
    transition: opacity 0.2s;
  }
}
</style>
