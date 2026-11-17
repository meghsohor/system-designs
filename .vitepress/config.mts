import { defineConfig } from 'vitepress'
import { slugify } from './lib/slug.ts'

export default defineConfig({
  base: '/system-designs/',
  lang: 'en',
  title: 'System Design Interview',
  description:
    'A 45-minute system design interview framework, the concepts behind it, and worked designs. Works offline.',
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    anchor: { slugify },
  },
  themeConfig: {
    search: { provider: 'local' },
  },
})
