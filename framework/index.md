# How to Approach a System Design Problem

A repeatable framework for ~45-minute system design interviews. This page is
the cheat sheet. Each step links to a longer guide in [approach/](approach/).

Most 45-minute slots leave 35–40 minutes of design time after intros and your
questions at the end. Plan for that, not for 45.

| # | Step | Time | Output |
|---|------|------|--------|
| 1 | [Understand the problem](approach/01-understand.md) | 1–2 min | One-sentence restatement + system shape |
| 2 | [Requirements](approach/02-requirements.md) | 5 min | Functional, non-functional, out of scope |
| 3 | [Estimation](approach/03-estimation.md) | 0–3 min (often deferred) | Numbers that change a design decision |
| 4 | [Core entities](approach/04-core-entities.md) | 2 min | Nouns the system stores and exchanges |
| 5 | [API design](approach/05-api-design.md) | 3–5 min | Endpoints, events, payloads |
| 6 | [High-level design](approach/06-high-level-design.md) | 10–15 min | Diagram covering every functional requirement |
| 7 | [Deep dives](approach/07-deep-dives.md) | 10 min | 2–3 bottlenecks, failures, trade-offs |
| 8 | [Wrap-up](approach/08-wrap-up.md) | 1–2 min (optional) | Summary + what breaks first |

---

## 1. Understand the problem

**Goal:** show you understood the prompt before solving it.

- Restate the problem in your own words.
- Name the **system shape**: read-heavy or write-heavy? Who produces data, who consumes it?
- Identify the **category** (e.g. real-time fan-out, URL shortener, rate limiter).

> "So we're building a read-heavy system where one external source produces
> updates and millions of users consume them in real time."

**Mistake to avoid:** asking the interviewer "what are the requirements?"
You lead. Propose, then ask for confirmation.

**Go deeper:** [approach/01-understand.md](approach/01-understand.md)

## 2. Requirements

**Goal:** turn a vague prompt into a concrete scope.

- **Functional:** what users can do. Find them by walking through the user
  journey step by step. Keep the top 3.
- **Non-functional:** how well it must work. Pick the 3–5 that matter for this
  system and put a number on each: "redirect p99 < 100 ms", not "low latency".
- **Consistency per feature:** choose it for each feature, not the whole
  system. Bookings need strong consistency; a feed can be eventual.
- **Out of scope:** say explicitly what you're not building.

**Mistakes to avoid:**
- Confusing **ordering** with **strong consistency** (CAP). You can guarantee
  ordering per entity and still choose availability.
- Forgetting things the prompt explicitly mentions. Re-read it.

**Go deeper:** [approach/02-requirements.md](approach/02-requirements.md)

## 3. Estimation

**Goal:** find where the load is, not exact numbers.

- Estimate only what affects design decisions: connections, read/write
  rates, data size, server count.
- It's fine to defer: "I'll estimate when it affects a design decision."
- Round aggressively (10M, 100K, ~100/sec).
- Quick math: 1 day ≈ 100K seconds, so 1M/day ≈ 12/sec. 1 KB × 1B items ≈ 1 TB.
- End every number with "so…": the decision it drives.

**Go deeper:** [approach/03-estimation.md](approach/03-estimation.md)

## 4. Core entities

**Goal:** name what's stored and exchanged, without writing the full schema yet.

- List the nouns from the requirements (e.g. User, ShortUrl, Click).
- Add key fields only. Fill in the rest during the high-level design.
- Separate **current state** (updated in place) from **history**
  (append-only).
- One-to-many is a foreign key on the "many" side. Many-to-many gets a join table.
- Every field should be justified by a requirement or a design need
  (e.g. sequence numbers for ordering, idempotency keys for retries).
- Name the **partition key**. It decides how you shard and where hot spots appear.
- Default to one database. Split only with a concrete reason.

**Go deeper:** [approach/04-core-entities.md](approach/04-core-entities.md)

## 5. API design

**Goal:** define the contract between client and system.

- One endpoint or event per functional requirement.
- Default to REST. Pick WebSocket, SSE, gRPC or webhooks only with a reason.
- Take the user from the auth token, never from the request body.
- Use cursor pagination for lists and idempotency keys for retried writes.
- Can be done while drawing, by labeling arrows.

**Go deeper:** [approach/05-api-design.md](approach/05-api-design.md)

## 6. High-level design

**Goal:** a working end-to-end design, simple first.

- Build **one functional requirement at a time**.
- Follow the data: ingest → storage → distribution → delivery.
- Show separate flows when they differ (e.g. live updates vs initial load).
- Label every arrow with what flows through it.
- One box per component is fine. Say "stateless, horizontally scaled."
- Spot complexity (cache, queue), mention it in one line, and park it for the deep dives.

**Mistakes to avoid:**
- An empty database (nothing writes to it).
- One service doing two jobs with very different load profiles.
- Saying **queue** when you mean **pub/sub**: a queue delivers each message
  to one consumer, pub/sub delivers it to every subscriber. Kafka is a
  **log**: every consumer group gets every message, and within a group each
  partition goes to one consumer.

**Go deeper:** [approach/06-high-level-design.md](approach/06-high-level-design.md)

## 7. Deep dives

**Goal:** prove the design survives the non-functional requirements.

- Pick topics driven by your NFRs: hot keys, failures, scaling bottlenecks.
- Go deep on 2–3 topics rather than skimming many.
- For each: describe the problem, propose a fix, name the trade-off.
- At senior level, find the weak spots yourself. Don't wait to be asked.
- Common topics: caching, hot partitions, dual writes, idempotency,
  reconnects, third-party failures.
- Interviewers now grade **cost** (cost per request, cache vs recompute) and
  **operations** (metrics, alerts, rollout, rollback) explicitly.
- If the prompt involves an LLM, treat it as a slow, expensive, rate-limited
  third party: streaming, token cost, caching, fallbacks, evaluation.

**Mistake to avoid:** over-engineering. Multi-region active-active for a
small system is a red flag, not a bonus.

**Go deeper:** [approach/07-deep-dives.md](approach/07-deep-dives.md)

## 8. Wrap-up

- Summarize the design in 3–4 sentences.
- Say what breaks first at 10× load and how you'd fix it.
- Mention what you'd add with more time (monitoring, multi-region, etc.).

**Go deeper:** [approach/08-wrap-up.md](approach/08-wrap-up.md)

---

## Throughout the interview

- Think aloud. A silent minute of drawing is a minute the interviewer can't grade.
- Check in when you move to the next step: "Does this cover what you had in mind?"
- Every time you pick something, say what you gave up for it.
- Leave room for the interviewer to probe. Their questions point at what they're grading.
