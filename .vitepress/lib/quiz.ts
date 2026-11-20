// Reads a design's quiz.md. Runs in Node: the catalog validates every quiz, and the
// markdown rule turns the page into the quiz component.
import { posix } from 'node:path'
import MarkdownIt from 'markdown-it'
import { headingIds } from './slug.ts'

export interface QuizOption {
  html: string
  correct: boolean
}

export interface QuizQuestion {
  /** Its place in the file, from 1, for error messages and keys. */
  number: number
  /** The question as plain text, for lists and error messages. */
  text: string
  html: string
  options: QuizOption[]
  /** More than one right option: checkboxes, right only on an exact match. */
  multiple: boolean
  explanation: string
  /** `target` is a content path like `designs/x/design.md`; `hash` is a heading ID or empty. */
  review: { text: string; target: string; hash: string }
}

export interface Quiz {
  title: string
  questions: QuizQuestion[]
}

// No raw HTML: the component shows these strings with v-html.
const md = new MarkdownIt()
type Token = ReturnType<MarkdownIt['parse']>[number]

const FRONTMATTER = /^---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/
const MARKER = /^\[([ xX])\]\s+/

function plainText(tokens: Token[]): string {
  return tokens
    .map((t) => {
      if (t.type === 'text' || t.type === 'code_inline') return t.content
      return t.type === 'softbreak' || t.type === 'hardbreak' ? ' ' : ''
    })
    .join('')
}

function blocks(src: string): Token[] {
  const body = src.replace(/^﻿/, '').replace(FRONTMATTER, '')
  return md.parse(body, {}).filter((t) => !(t.type === 'html_block' && /^\s*<!--/.test(t.content)))
}

/** Index of the token that closes the one opened at `start`. */
function closeOf(tokens: Token[], start: number): number {
  const open = tokens[start]
  const type = open?.type.replace(/_open$/, '_close')
  const at = tokens.findIndex((t, i) => i > start && t.type === type && t.level === open?.level)
  return at === -1 ? tokens.length - 1 : at
}

function linkUrl(href: string, quizPath: string): { target: string; hash: string } | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/')) return undefined
  const [file = '', hash = ''] = href.split('#', 2)
  if (!file.endsWith('.md')) return undefined
  const target = posix.normalize(posix.join(posix.dirname(quizPath), decodeURI(file)))
  if (target.startsWith('../')) return undefined
  return { target, hash: decodeURIComponent(hash) }
}

/**
 * Parses a quiz file. `problems` names the file and question for each mistake; the quiz is
 * still returned so the dev server can show what it has.
 */
export function parseQuiz(src: string, quizPath: string): { quiz: Quiz; problems: string[] } {
  const tokens = blocks(src)
  const problems: string[] = []
  const quiz: Quiz = { title: '', questions: [] }
  const where = (n: number, text: string) => `${quizPath}: question ${n} ("${text}")`

  // `listed` counts every list item, so a malformed option isn't also reported as missing.
  type Draft = Omit<QuizQuestion, 'review' | 'multiple' | 'number'> & {
    review?: QuizQuestion['review']
    listed: number
    reviewLine: boolean
  }
  const drafts: Draft[] = []
  let current: Draft | undefined
  // Links and images in quiz text aren't resolved like the page's own, so they'd break.
  const noLinks = (inline: Token | undefined, what: string) => {
    const kinds = new Set(inline?.children?.map((c) => c.type))
    if (current && kinds.has('link_open')) {
      problems.push(
        `${where(drafts.length, current.text)}: ${what} has a link; use the Review line`,
      )
    }
    if (current && kinds.has('image')) {
      problems.push(`${where(drafts.length, current.text)}: ${what} has an image`)
    }
  }
  const once = (seen: boolean, what: string) => {
    if (current && seen) problems.push(`${where(drafts.length, current.text)}: has two ${what}`)
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!token) continue
    const close = token.nesting === 1 ? closeOf(tokens, i) : i
    const inline = tokens[i + 1]

    if (token.type === 'heading_open' && token.tag === 'h1' && i === 0) {
      quiz.title = plainText(inline?.children ?? []).trim()
    } else if (token.type === 'heading_open' && token.tag === 'h2') {
      current = {
        text: plainText(inline?.children ?? []).trim(),
        html: md.renderInline(inline?.content ?? ''),
        options: [],
        explanation: '',
        listed: 0,
        reviewLine: false,
      }
      drafts.push(current)
      noLinks(inline, 'the question')
    } else if (!current) {
      problems.push(`${quizPath}: expected "# Title" and then "## Question" headings`)
      break
    } else if (token.type === 'bullet_list_open') {
      for (let j = i + 1; j < close; j++) {
        if (tokens[j]?.type !== 'list_item_open' || tokens[j]?.level !== token.level + 1) continue
        const item = tokens.slice(j, closeOf(tokens, j))
        current.listed++
        const text = item.find((t) => t.type === 'inline')
        const marker = MARKER.exec(text?.content ?? '')
        if (!marker || item.filter((t) => t.type === 'inline').length > 1) {
          problems.push(
            `${where(drafts.length, current.text)}: option ${current.listed} must be "- [ ] text" or "- [x] text"`,
          )
          continue
        }
        noLinks(text, 'an option')
        current.options.push({
          html: md.renderInline((text?.content ?? '').slice(marker[0].length)),
          correct: marker[1] !== ' ',
        })
      }
    } else if (token.type === 'blockquote_open') {
      once(current.explanation !== '', 'explanations')
      current.explanation = md.renderer.render(tokens.slice(i + 1, close), md.options, {}).trim()
      for (const t of tokens.slice(i + 1, close))
        if (t.type === 'inline') noLinks(t, 'the explanation')
    } else if (token.type === 'paragraph_open' && /^Review:\s*\[/.test(inline?.content ?? '')) {
      once(current.reviewLine, 'Review lines')
      current.reviewLine = true
      const children = inline?.children ?? []
      const open = children.findIndex((c) => c.type === 'link_open')
      const end = children.findIndex((c, k) => k > open && c.type === 'link_close')
      const href = children[open]?.attrGet('href') ?? ''
      const url = linkUrl(href, quizPath)
      if (!url) {
        problems.push(
          `${where(drafts.length, current.text)}: the review link must point to a page in the book: ${href}`,
        )
      } else {
        current.review = { text: plainText(children.slice(open + 1, end)).trim(), ...url }
      }
    } else {
      problems.push(
        `${where(drafts.length, current.text)}: unexpected ${token.type.replace(/_open$/, '')}`,
      )
    }
    i = close
  }

  if (!quiz.title) problems.unshift(`${quizPath}: must start with a "# Title" line`)
  if (drafts.length === 0) problems.push(`${quizPath}: has no questions`)

  drafts.forEach((draft, index) => {
    const at = where(index + 1, draft.text)
    const right = draft.options.filter((o) => o.correct).length
    if (draft.listed < 2) problems.push(`${at}: needs at least 2 options`)
    if (right === 0) problems.push(`${at}: no option is marked [x]`)
    if (!draft.explanation) problems.push(`${at}: the explanation ("> …") is missing`)
    if (!draft.reviewLine) {
      problems.push(`${at}: the "Review: [text](page.md#heading)" line is missing`)
    }
    const { review, text, html, options, explanation } = draft
    if (!review) return
    const multiple = right > 1
    quiz.questions.push({ number: index + 1, text, html, options, multiple, explanation, review })
  })
  return { quiz, problems }
}

/** Heading IDs of a page, as GitHub and the site give them. */
export function pageHeadingIds(src: string): string[] {
  const tokens = blocks(src)
  const titles = tokens.flatMap((t, i) =>
    t.type === 'heading_open' ? [plainText(tokens[i + 1]?.children ?? []).trim()] : [],
  )
  return headingIds(titles)
}

/** Problems with review links whose page or heading doesn't exist. `read` returns undefined for a missing page. */
export function checkReviewLinks(
  quiz: Quiz,
  quizPath: string,
  read: (path: string) => string | undefined,
): string[] {
  const ids = new Map<string, Set<string> | undefined>()
  const problems: string[] = []
  quiz.questions.forEach((question) => {
    const { target, hash } = question.review
    if (!ids.has(target)) {
      const src = read(target)
      ids.set(target, src === undefined ? undefined : new Set(pageHeadingIds(src)))
    }
    const found = ids.get(target)
    const at = `${quizPath}: question ${question.number} ("${question.text}")`
    if (!found) problems.push(`${at}: the review link points to a missing page: ${target}`)
    else if (hash && !found.has(hash)) {
      problems.push(`${at}: the review link's heading doesn't exist: ${target}#${hash}`)
    }
  })
  return problems
}
