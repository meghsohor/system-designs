import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import BookLayout from './BookLayout.vue'

export default {
  extends: DefaultTheme,
  Layout: BookLayout,
} satisfies Theme
