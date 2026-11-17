# system-designs

System design interview notes, published as an offline-first ebook at https://meghsohor.github.io/system-designs/. VitePress 1.6 with Vue 3 and TypeScript, tested with Vitest. The notes are plain markdown and must keep reading well on GitHub.

## Commands

- `nvm use` — Node 26 (see `.nvmrc`)
- `npm run dev` — dev server at http://localhost:5173/system-designs/
- `npm run build` — VitePress build, then `scripts/check-links.ts` (fails on any broken internal link, image or `#anchor`)
- `npm run preview` — serve the built site
- `npm test` — unit tests in `tests/`
- `npm run check` — `vue-tsc`, ESLint and Prettier; run before every commit
- `npm run format` — Prettier write

## Structure

- `content/` — every note (VitePress `srcDir`); URLs don't include `content`
  - `learn/framework/` — the 8-step interview framework; `index.md` is the overview
  - `learn/foundations/`, `learn/toolbox/`, `learn/playbook/` — topic guides
  - `designs/<name>/design.md` — worked designs, with an optional `quiz.md`
  - `index.md` — home page
- `.vitepress/config.mts` — site config
- `.vitepress/lib/` — Node-side code: `catalog.ts` (table of contents and build validation), `sidebar.ts`, `slug.ts`
- `.vitepress/theme/` — Vue components and CSS
- `scripts/` — build scripts; `tests/` — unit tests
- `specs/` — local-only planning docs (git-excluded)

## Writing content

- Each section's `index.md` is its table of contents. Page order is the order it links to pages: `- [Title](page.md): one-line summary`.
- To add a page: create the `.md` in the section folder with `# Title` as its first line, then link it from the section's `index.md`. The build fails if a page isn't linked, a link points to a missing file, or a page has no `# Title`.
- A page with nothing after its title shows as "Coming soon" and doesn't count towards progress.
- Use relative `.md` links so they work on GitHub and on the site. Heading anchors use GitHub's slugs.
- Name links after what the reader gets, never a file path: `[Full guide to requirements →](02-requirements.md)`.
- Images use `./` paths. Excalidraw diagrams keep the `.excalidraw` source next to the exported `.svg` (no embedded scene); link the source by its GitHub URL, since it isn't part of the site.
- Prettier never touches `.md` files.

## Conventions

- TypeScript `strict`. Node scripts run as `.ts` with Node's type stripping: import with the `.ts` extension and use erasable syntax only (no enums or namespaces).
- Vue components use `<script setup lang="ts">`. Prefer native HTML elements (`<dialog>`, `popover`, `<select>`, `<details>`, `<progress>`, forms) over custom widgets; no UI or CSS library. Style with VitePress CSS variables.
- State saved in the browser loads in `onMounted`, never during server rendering.
- Pin exact dependency versions. A new package with install scripts must be approved with `npm install-scripts approve <pkg>`; the decision is recorded in `package.json` `allowScripts`.
- Commit messages are one line, starting with `Added:`, `Updated:`, `Moved:` or `Fixed:`.
