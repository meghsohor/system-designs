<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import ComingSoon from './components/ComingSoon.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-footer-before>
      <ComingSoon />
    </template>
  </Layout>
</template>
