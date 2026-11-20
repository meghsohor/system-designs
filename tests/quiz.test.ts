import { describe, expect, it } from 'vitest'
import { checkReviewLinks, pageHeadingIds, parseQuiz } from '../.vitepress/lib/quiz.ts'

const PATH = 'designs/short/quiz.md'

const question = (
  overrides: Partial<Record<'title' | 'options' | 'why' | 'review', string>> = {},
) =>
  [
    `## ${overrides.title ?? 'Why 302?'}`,
    overrides.options ?? '- [ ] Faster\n- [x] Browsers **don’t** cache it',
    overrides.why ?? '> A 301 is cached.',
    overrides.review ?? 'Review: [API design](design.md#5-api-design)',
  ].join('\n\n')

const quiz = (...questions: string[]) => `# Shortener quiz\n\n${questions.join('\n\n')}\n`

describe('parseQuiz', () => {
  it('reads the title, questions, options, explanation and review link', () => {
    const { quiz: parsed, problems } = parseQuiz(quiz(question()), PATH)
    expect(problems).toEqual([])
    expect(parsed).toEqual({
      title: 'Shortener quiz',
      questions: [
        {
          number: 1,
          text: 'Why 302?',
          html: 'Why 302?',
          options: [
            { html: 'Faster', correct: false },
            { html: 'Browsers <strong>don’t</strong> cache it', correct: true },
          ],
          multiple: false,
          explanation: '<p>A 301 is cached.</p>',
          review: { text: 'API design', target: 'designs/short/design.md', hash: '5-api-design' },
        },
      ],
    })
  })

  it('makes a question with several right options "choose all that apply"', () => {
    const options = '- [x] Redis\n- [X] `expires_at`\n- [ ] The counter'
    const { quiz: parsed } = parseQuiz(quiz(question({ options })), PATH)
    expect(parsed.questions[0]?.multiple).toBe(true)
    expect(parsed.questions[0]?.options[1]).toEqual({
      html: '<code>expires_at</code>',
      correct: true,
    })
  })

  it('resolves review links to other folders and keeps a link without a heading', () => {
    const review = 'Review: [Caching](../../learn/toolbox/caching.md)'
    const { quiz: parsed, problems } = parseQuiz(quiz(question({ review })), PATH)
    expect(problems).toEqual([])
    expect(parsed.questions[0]?.review).toMatchObject({
      target: 'learn/toolbox/caching.md',
      hash: '',
    })
  })

  it('names the file and question for each mistake', () => {
    const src = quiz(
      question({ title: 'One option', options: '- [x] Only' }),
      question({ title: 'None right', options: '- [ ] A\n- [ ] B' }),
      question({ title: 'No why', why: '' }),
      question({ title: 'No review', review: '' }),
      question({ title: 'No marker', options: '- [x] A\n- B' }),
    )
    const { problems } = parseQuiz(src, PATH)
    expect(problems).toEqual([
      `${PATH}: question 5 ("No marker"): option 2 must be "- [ ] text" or "- [x] text"`,
      `${PATH}: question 1 ("One option"): needs at least 2 options`,
      `${PATH}: question 2 ("None right"): no option is marked [x]`,
      `${PATH}: question 3 ("No why"): the explanation ("> …") is missing`,
      `${PATH}: question 4 ("No review"): the "Review: [text](page.md#heading)" line is missing`,
    ])
  })

  it('rejects review links outside the book and links elsewhere in a question', () => {
    const src = quiz(
      question({ title: 'Web', review: 'Review: [Docs](https://example.com)' }),
      question({ title: 'Linked', why: '> See [this](design.md).' }),
    )
    expect(parseQuiz(src, PATH).problems).toEqual([
      `${PATH}: question 1 ("Web"): the review link must point to a page in the book: https://example.com`,
      `${PATH}: question 2 ("Linked"): the explanation has a link; use the Review line`,
    ])
  })

  it('rejects images, and a second explanation or Review line', () => {
    const src = quiz(
      question({ title: 'Pictured', why: '> See ![x](./x.svg)' }),
      question({ title: 'Twice', why: '> One.\n\n> Two.' }) +
        '\n\nReview: [API design](design.md#5-api-design)',
    )
    expect(parseQuiz(src, PATH).problems).toEqual([
      `${PATH}: question 1 ("Pictured"): the explanation has an image`,
      `${PATH}: question 2 ("Twice"): has two explanations`,
      `${PATH}: question 2 ("Twice"): has two Review lines`,
    ])
  })

  it('reports a missing title, stray text and an empty quiz', () => {
    expect(parseQuiz('Intro text\n', PATH).problems).toEqual([
      `${PATH}: must start with a "# Title" line`,
      `${PATH}: expected "# Title" and then "## Question" headings`,
      `${PATH}: has no questions`,
    ])
    expect(parseQuiz(quiz(question() + '\n\nStray paragraph.'), PATH).problems).toEqual([
      `${PATH}: question 1 ("Why 302?"): unexpected paragraph`,
    ])
  })
})

describe('checkReviewLinks', () => {
  const design = '# Shortener\n\n## 5. API design\n\n## Notes\n\n## Notes\n'
  const read = (path: string) => (path === 'designs/short/design.md' ? design : undefined)

  it('accepts headings as GitHub numbers them, duplicates included', () => {
    expect(pageHeadingIds(design)).toEqual(['shortener', '5-api-design', 'notes', 'notes-1'])
    const review = 'Review: [Notes](design.md#notes-1)'
    const { quiz: parsed } = parseQuiz(quiz(question({ review })), PATH)
    expect(checkReviewLinks(parsed, PATH, read)).toEqual([])
  })

  it('numbers questions by their place in the file', () => {
    const { quiz: parsed } = parseQuiz(
      quiz(
        question({ title: 'No review', review: '' }),
        question({ title: 'Bad heading', review: 'Review: [API](design.md#api)' }),
      ),
      PATH,
    )
    expect(checkReviewLinks(parsed, PATH, read)).toEqual([
      `${PATH}: question 2 ("Bad heading"): the review link's heading doesn't exist: designs/short/design.md#api`,
    ])
  })

  it('reports a missing heading or page', () => {
    const { quiz: parsed } = parseQuiz(
      quiz(
        question({ title: 'Bad heading', review: 'Review: [API](design.md#api)' }),
        question({ title: 'Bad page', review: 'Review: [Gone](gone.md#x)' }),
      ),
      PATH,
    )
    expect(checkReviewLinks(parsed, PATH, read)).toEqual([
      `${PATH}: question 1 ("Bad heading"): the review link's heading doesn't exist: designs/short/design.md#api`,
      `${PATH}: question 2 ("Bad page"): the review link points to a missing page: designs/short/gone.md`,
    ])
  })
})
