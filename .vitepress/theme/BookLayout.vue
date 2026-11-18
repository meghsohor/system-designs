<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import ComingSoon from './components/ComingSoon.vue'
import ZoomDialog from './components/ZoomDialog.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-footer-before>
      <ComingSoon />
    </template>
    <template #layout-bottom>
      <ZoomDialog />
    </template>
  </Layout>
</template>
