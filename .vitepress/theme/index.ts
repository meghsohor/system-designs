import type { Theme } from 'vitepress'
// The default entry ships Inter for every script (~650 KB); style.css loads a Latin-only subset.
import DefaultTheme from 'vitepress/theme-without-fonts'
import BookLayout from './BookLayout.vue'
import HomePage from './components/HomePage.vue'
import ProgressPage from './components/ProgressPage.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: BookLayout,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage)
    app.component('ProgressPage', ProgressPage)
  },
} satisfies Theme
