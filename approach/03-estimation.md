# 3. Estimation

**Time:** 0–3 min, often deferred · **Output:** the few numbers that change a design decision

[← Back to the framework](../APPROACH.md#3-estimation) · [← Requirements](02-requirements.md) · [Next: Core entities →](04-core-entities.md)

## When to estimate

Many interviewers no longer want a full page of math up front. Do the math
only when the answer changes the design: "Can one database handle this?",
"Do we need to shard?", "How many connection servers?"

It's fine to say: "I'll estimate when a number decides something." If the
interviewer asks for numbers up front, give them in 2–3 minutes.

## Which numbers matter

| Number | Decides |
|---|---|
| Read and write requests per second (average and peak) | Caching, replicas, sharding |
| Storage over 5 years | One node or sharded; hot vs cold storage |
| Concurrent connections | Number of WebSocket/SSE servers |
| Bandwidth | CDN, compression |
| Hot data size | Whether the cache fits in memory |

## Cheat sheet

**Time and rates**

- 1 day ≈ 86,400 s ≈ **100K seconds**
- 1M per day ≈ **12 per second**; 1B per day ≈ **12K per second**
- Peak ≈ 2–3× average (much more for live events like a cup final)

**Size**

- 1 KB × 1M = 1 GB · 1 KB × 1B = **1 TB**
- Base62 codes: 62⁶ ≈ 57B, 62⁷ ≈ 3.5T

**Latency (orders of magnitude)**

| Operation | Time |
|---|---|
| Memory read | ~100 ns |
| SSD random read | ~100 µs |
| Round trip in one data center | ~0.5 ms |
| Round trip across a continent | ~50–150 ms |

**Rough single-node capacity.** This depends heavily on the workload, so use it to find the order of magnitude only.

| Component | Rough capacity |
|---|---|
| Redis | ~100K simple ops/sec |
| Postgres/MySQL | ~thousands to low tens of thousands of simple queries/sec; writes lower |
| Stateless app server | ~1K–10K simple requests/sec |
| WebSocket server (tuned) | ~100K–1M mostly idle connections |

## Worked example (URL shortener)

| Estimate | Math | So… |
|---|---|---|
| Writes | 100M/month ≈ 3.3M/day ≈ **40/s**, ~100/s at peak | The write path is easy; one database handles it |
| Reads | 1B/day ≈ **12K/s**, maybe 50K/s at peak | Put a cache in front of the database |
| Storage | 100M × 12 × 5 years = 6B rows × ~500 B ≈ **3 TB** | Too much for one comfortable node; plan to shard or use a KV store |
| Code length | 62⁶ ≈ 57B > 6B | 6 base62 characters are enough; 7 gives headroom |

## Mistakes to avoid

- Estimating numbers that don't change anything.
- False precision ("11,574 QPS"). Round to one significant figure.
- Forgetting the peak. Systems fall over at peak, not at the average.
- Stopping at the number. Always finish with "so…" and the decision it drives.
