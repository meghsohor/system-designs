import pluginVue from 'eslint-plugin-vue'
import vueA11y from 'eslint-plugin-vuejs-accessibility'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default defineConfigWithVueTs(
  {
    ignores: [
      'node_modules/**',
      '.vitepress/dist/**',
      '.vitepress/cache/**',
      'public/diagrams/**',
      'specs/**',
    ],
  },
  pluginVue.configs['flat/recommended'],
  vueA11y.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  prettier,
)
