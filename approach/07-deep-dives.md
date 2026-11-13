# 7. Deep dives

**Time:** ~10 min · **Output:** 2–3 weak spots, each with a fix and its trade-off

[← Back to the framework](../APPROACH.md#7-deep-dives) · [← High-level design](06-high-level-design.md) · [Next: Wrap-up →](08-wrap-up.md)

## Why it matters

The high-level design shows the system works. The deep dives show it
survives the non-functional requirements: the load, the failures, the
consistency rules. This is where your level is decided.

- **Mid-level:** answer the interviewer's probes well.
- **Senior and above:** find the weak spots yourself and lead the discussion.

Go deep on 2–3 topics rather than skimming six. Leave room for the
interviewer to steer. Their questions show what they're grading.

## How to structure each topic

1. **Problem:** what breaks, and under which requirement.
2. **Options:** two realistic fixes.
3. **Choice:** pick one and say why.
4. **Trade-off:** what you gave up.
5. **Signal:** the metric that tells you it's working.

## Topic catalog

| Topic | Symptom | Common fixes | Trade-off |
|---|---|---|---|
| Caching | Slow reads, database overloaded | Cache-aside with TTL; write-through | Stale data; invalidation; stampede on expiry (fix with request coalescing and TTL jitter) |
| Hot keys / partitions | One shard or cache node overloaded | Split the key (`key#1..N`), replicate hot keys, in-process cache | Reads fan out; more complexity |
| Scaling reads | Database CPU high on reads | Read replicas, cache, CDN | Replica lag |
| Scaling writes | Database can't keep up with writes | Sharding, batching, async writes through a queue | Cross-shard queries, rebalancing |
| Dual writes | Database and queue disagree after a crash | Outbox pattern or change data capture (CDC) | Extra moving part, a little more latency |
| Retries and idempotency | Duplicate orders or messages | Idempotency keys, dedupe table, idempotent consumers | Storage for keys; at-least-once delivery |
| Ordering | Events arrive out of order | Partition by entity, sequence numbers, client drops stale events | Order only per entity, not global |
| Real-time connections | Clients miss updates after reconnecting | Resume from last sequence number, replay from the log, heartbeats | Keep history long enough to replay |
| Contention | Double-booking, lost updates | Optimistic locking (`version`), database constraints, short-lived reservations | Retries under contention; holds expire |
| Third-party failure | A slow dependency takes you down | Timeouts, retries with backoff and jitter, circuit breaker, fallback | Degraded results |
| Fan-out | Writing to millions of feeds is slow | Fan-out on write for most users, on read for celebrities (hybrid) | Two code paths |
| Multi-region | Region outage, global latency | Only if a requirement demands it | Cost, conflicts, complexity |

## Cost

Interviewers now grade cost explicitly, especially for senior roles.

- Estimate **cost per request**, or per 1,000 requests, for the expensive parts.
- Weigh **cache vs recompute**, **hot vs cold storage**, and data transfer out of the cloud (egress).
- Say what each fix costs, not just what it buys.
- **Over-engineering is penalised.** Active-active multi-region for a small
  app is a red flag. Match the design to the stated scale.

## Operations

Observability, deployment, rollback and on-call burden are no longer bonus topics.

- **Metrics:** latency, traffic, errors, saturation. Set an SLO for the
  main operation and alert on it.
- **Tracing:** follow one request across services.
- **Rollout:** canary or blue-green deploys, feature flags, and a tested rollback path.
- **Data changes:** how you migrate or backfill without downtime.
- **On-call burden:** every component you add is something that can page someone at 3 a.m.

## AI components

Use this when the prompt includes an LLM, retrieval (RAG) or an agent, or the
interviewer adds "now add an AI feature". Treat the model as a slow,
expensive, rate-limited, non-deterministic third-party dependency.

| Concern | What to cover |
|---|---|
| Latency | Stream tokens over SSE; measure time to first token; send easy requests to a smaller model |
| Cost | Tokens in + out × requests/sec; prompt caching; semantic cache for repeated questions; trim context |
| Retrieval (RAG) | Ingestion: chunk → embed → vector store; hybrid search (keyword + vector) plus re-ranking; re-embed when documents change; filter by user permissions |
| Reliability | Provider rate limits and outages: timeouts, retries with backoff, a fallback model, a queue for non-interactive work |
| Safety | Input and output guardrails; prompt injection from retrieved documents; strip personal data |
| Quality | An offline evaluation set plus live signals (thumbs up/down, resolution rate); version prompts and models; log traces |
| Agents | An orchestrator controls the loop; tools run in a sandbox; limits on steps and spend |

## Mistakes to avoid

- Listing eight topics and going deep on none.
- A fix without a trade-off.
- At senior level, waiting for the interviewer to find the problems.
- Talking over the interviewer when they try to probe.
