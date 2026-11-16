# 1. Understand the problem

**Time:** 1–2 min · **Output:** a one-sentence restatement and the system's shape

[← Back to the framework](../APPROACH.md#1-understand-the-problem) · [Next: Requirements →](02-requirements.md)

## Why it matters

The interviewer checks that you solve the problem they asked, not a similar
one you practised. Prompts are often vague on purpose. Two minutes here saves
ten minutes of designing the wrong thing. Designing before clarifying is the
most commonly reported reason for failing.

## How to do it

### 1. Restate it in one sentence

Who uses it, what they do, and roughly at what scale.

### 2. Name the shape

Answer these out loud:

- **Read-heavy or write-heavy?** Guess the ratio (100:1 reads to writes is common).
- **Who produces data, who consumes it?** One-to-one, one-to-many (fan-out),
  or many-to-one (aggregation)?
- **Request/response or push?** Does the client ask, or does the server tell
  the client when something changes?
- **Is there a hard correctness core?** Money, inventory, seats and unique IDs
  can't be "eventually right".

### 3. Name the category

Most prompts are a variation on a known pattern. Naming it tells you which
deep dives are coming.

| Category | Examples | Deep dives to expect |
|---|---|---|
| Key-value lookup | URL shortener, Pastebin | ID generation, caching, hot keys |
| Fan-out / feed | News feed, Twitter | Push vs pull fan-out, celebrity users |
| Real-time push | Chat, live scores, notifications | WebSocket/SSE connections, reconnects, ordering |
| Contention / booking | Ticketing, hotel booking | Locking, double-booking, consistency |
| Geo / matching | Ride sharing, nearby places | Geo-indexing, location update rate |
| Counting / limits | Rate limiter, top-K, ad clicks | Counters, approximation, time windows |
| Search | Autocomplete, full-text search | Indexing, ranking, tries |
| Large media | Video streaming, file sync | Chunked upload, CDN, transcoding |
| AI-backed | RAG chatbot, LLM summaries | Token cost, latency, retrieval, guardrails |

## Example

> "So we're building a URL shortener: users turn long URLs into short codes,
> and anyone with the code gets redirected. It's very read-heavy, maybe 100
> reads per write, and redirects must be fast because they sit in front of
> every click. Short codes must be unique, so that part needs strong
> consistency."

## Ask questions that change the design

Ask only questions whose answer changes what you'll build.

| Good | Why | Weak | Why |
|---|---|---|---|
| "Do links expire?" | Changes storage and cleanup | "Which language should I use?" | Doesn't change the design |
| "Is this global or one region?" | Changes latency and replication | "Should it be scalable?" | The answer is always yes |
| "Can users edit a link after creating it?" | Changes caching and consistency | "Do we need a database?" | You decide that |

## Mistakes to avoid

- Asking "what are the requirements?" You lead: propose, then ask for confirmation.
- Drawing boxes before you restate the problem.
- Asking ten clarifying questions in a row. Ask two or three, then propose.
