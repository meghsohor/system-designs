import type { Theme } from 'vitepress'
// The default entry ships Inter for every script (~650 KB); style.css loads a Latin-only subset.
import DefaultTheme from 'vitepress/theme-without-fonts'
import BookLayout from './BookLayout.vue'
import DesignCards from './components/DesignCards.vue'
import HomePage from './components/HomePage.vue'
import PageActions from './components/PageActions.vue'
import ProgressPage from './components/ProgressPage.vue'
import QuizRunner from './components/QuizRunner.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: BookLayout,
  enhanceApp({ app }) {
    app.component('DesignCards', DesignCards)
    app.component('HomePage', HomePage)
    app.component('ProgressPage', ProgressPage)
    app.component('PageActions', PageActions)
    app.component('QuizRunner', QuizRunner)
  },
} satisfies Theme
