import { useRoute, type Theme } from 'vitepress'
// The default entry ships Inter for every script (~650 KB); style.css loads a Latin-only subset.
import DefaultTheme from 'vitepress/theme-without-fonts'
import { nextTick, onMounted, watch } from 'vue'
import BookLayout from './BookLayout.vue'
import HomePage from './components/HomePage.vue'
import { setUpZoom } from './zoom.ts'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: BookLayout,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage)
  },
  setup() {
    const route = useRoute()
    onMounted(() => {
      const refresh = setUpZoom()
      refresh()
      watch(
        () => route.path,
        () => nextTick(refresh),
      )
    })
  },
} satisfies Theme
