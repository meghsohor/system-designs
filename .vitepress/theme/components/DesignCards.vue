<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { ThemeConfig } from '../../config.mts'
import { designOrder } from '../designs.ts'
import DesignCard from './DesignCard.vue'

// The designs as cards: on the Designs page in place of its list, and on the home page.
const props = defineProps<{ limit?: number }>()
const { theme } = useData<ThemeConfig>()

const designs = computed(() => {
  const pages = designOrder(theme.value.catalog.find((s) => s.id === 'designs')?.pages ?? [])
  return props.limit ? pages.slice(0, props.limit) : pages
})
</script>

<template>
  <ul class="design-cards">
    <li v-for="page in designs" :key="page.path" class="item">
      <DesignCard :page="page" />
    </li>
  </ul>
</template>

<style scoped>
/* Also overrides VitePress's list styles when it sits in a doc page. */
.design-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--design-card-min, 260px)), 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  margin: 0;
}
</style>
