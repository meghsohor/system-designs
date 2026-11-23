<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import ComingSoon from './components/ComingSoon.vue'
import ListenPlayer from './components/ListenPlayer.vue'
import PagePanel from './components/PagePanel.vue'
import ReadingTracker from './components/ReadingTracker.vue'
import TextSize from './components/TextSize.vue'
import TextSizeControls from './components/TextSizeControls.vue'
import ToastMessage from './components/ToastMessage.vue'
import ZoomDialog from './components/ZoomDialog.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-footer-before>
      <ComingSoon />
      <PagePanel placement="end" />
    </template>
    <template #doc-after>
      <ListenPlayer />
    </template>
    <template #aside-outline-after>
      <PagePanel placement="aside" />
    </template>
    <template #nav-bar-content-after>
      <TextSize />
    </template>
    <template #nav-screen-content-after>
      <div class="text-size-menu">
        <TextSizeControls label-id="text-size-menu-label" />
      </div>
    </template>
    <template #layout-bottom>
      <ZoomDialog />
      <ReadingTracker />
      <ToastMessage />
    </template>
  </Layout>
</template>

<style scoped>
/* Phones only: from 768 px the nav bar has its own Aa button. */
.text-size-menu {
  margin-top: 24px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

@media (min-width: 768px) {
  .text-size-menu {
    display: none;
  }
}
</style>
