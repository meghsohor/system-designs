# system-designs

System design interview notes, published as an offline-first ebook at https://meghsohor.github.io/system-designs/. VitePress 1.6 with Vue 3 and TypeScript, tested with Vitest. The notes are plain markdown and must keep reading well on GitHub.

## Commands

- `nvm use` — Node 26 (see `.nvmrc`)
- `npm run dev` — renders diagrams, then the dev server at http://localhost:5173/system-designs/
- `npm run build` — renders diagrams, VitePress build, then `scripts/check-links.ts` (fails on any broken internal link, image or `#anchor`)
- `npm run diagrams` — renders Mermaid blocks to `content/public/diagrams/` (git-ignored) and deletes unused ones
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
- `.vitepress/lib/` — Node-side code: `catalog.ts` (table of contents and build validation), `mermaid.ts` (diagram rendering), `sidebar.ts`, `slug.ts`
- `.vitepress/theme/` — Vue components and CSS
- `scripts/` — build scripts; `tests/` — unit tests
- `specs/` — local-only planning docs (git-excluded)

## Writing content

- Each section's `index.md` is its table of contents. Page order is the order it links to pages: `- [Title](page.md): one-line summary`.
- To add a page: create the `.md` in the section folder with `# Title` as its first line, then link it from the section's `index.md`. The build fails if a page isn't linked, a link points to a missing file, or a page has no `# Title`.
- A page with nothing after its title shows as "Coming soon" and doesn't count towards progress.
- Use relative `.md` links so they work on GitHub and on the site. Heading anchors use GitHub's slugs.
- Name links after what the reader gets, never a file path: `[Full guide to requirements →](02-requirements.md)`.
- Diagrams for a design are drawn in Excalidraw. The `.excalidraw` source sits next to its exported `.svg` (export without the embedded scene); link the source by its GitHub URL, since it isn't part of the site.
  - Each part a note shows on its own is an Excalidraw frame, named after what it shows. Export each frame as SVG (select the frame → Export image, background off, 1×) next to the note, named after the frame in kebab case (`create-short-url.svg`), and use it as an image with a caption.
  - Excalidraw shows frame names and outlines in a full-drawing export; turn them off under View if they get in the way.
- Mermaid ` ```mermaid ` blocks still work for quick diagrams: the site shows them as pre-rendered SVGs, and GitHub renders the blocks itself. Add `accTitle: …` to a block: it becomes the image's alt text and caption.
- Images use markdown syntax with `./` paths, alone in their paragraph: `![What it shows](./x.svg "Caption")`. The title becomes the caption. Raw `<img>` tags get no caption or zoom button.
- Diagrams and images fit the column and get a zoom button that opens them in a popup.
- Callouts use GitHub alert syntax, so they work on GitHub too. Put the marker alone on the first line:
  - `> [!NOTE]` background or a side fact
  - `> [!TIP]` advice for the interview
  - `> [!IMPORTANT]` something not to miss
  - `> [!WARNING]` a common mistake
  - `> [!CAUTION]` something that breaks things
  Don't use VitePress `::: tip` containers; GitHub shows them as plain text.
- Prettier never touches `.md` files.

## Conventions

- TypeScript `strict`. Node scripts run as `.ts` with Node's type stripping: import with the `.ts` extension and use erasable syntax only (no enums or namespaces).
- Vue components use `<script setup lang="ts">`. Prefer native HTML elements (`<dialog>`, `popover`, `<select>`, `<details>`, `<progress>`, forms) over custom widgets; no UI or CSS library. Style with VitePress CSS variables.
- State saved in the browser loads in `onMounted`, never during server rendering. The one exception is the text size: a tiny `<head>` script (`.vitepress/lib/text-size.ts`) applies it before the first paint, so text never jumps size.
- Pin exact dependency versions. A new package with install scripts must be approved with `npm install-scripts approve <pkg>`; the decision is recorded in `package.json` `allowScripts`.
- Commit messages are one line, starting with `Added:`, `Updated:`, `Moved:` or `Fixed:`.
