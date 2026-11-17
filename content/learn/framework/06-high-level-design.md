# 6. High-level design

**Time:** 10–15 min · **Output:** a diagram that covers every functional requirement end to end

[← Back to the framework](index.md#6-high-level-design) · [← API design](05-api-design.md) · [Next: Deep dives →](07-deep-dives.md)

## Why it matters

Not delivering a working system is the most common reason mid-level
candidates fail. A simple design that works beats a clever one that's half
drawn. Get every requirement working first, then make it better.

## How to do it

1. **One functional requirement at a time.** Draw the path for one endpoint, then the next.
2. **Follow the data.** For requests: client → load balancer/gateway →
   service → storage → back. For async systems: ingest → storage →
   distribution → delivery.
3. **Narrate the state changes.** "The service writes the row, then publishes
   an event; the fan-out worker picks it up…"
4. **Write the relevant fields next to each database.** This is where the
   entities from step 4 get their real fields.
5. **Draw separate flows when they differ.** Write path vs read path, or live
   updates vs the first page load.
6. **Label every arrow** with what flows through it.
7. **Park complexity.** "We'll need a cache here. I'll come back to it in the
   deep dives." Then keep going.

## Building blocks

| Block | Use it for | Say |
|---|---|---|
| Load balancer | Spreading requests across servers | "L7, round-robin; sticky only for connection servers" |
| API gateway | Auth, rate limiting, routing | "Handles auth and rate limits before the services" |
| Stateless service | Business logic | "Stateless, horizontally scaled" |
| Cache | Hot reads | "Cache-aside with a TTL" |
| Database | Source of truth | Name the partition key |
| Object storage + CDN | Files, media, static content | "Upload with a presigned URL, serve from the CDN" |
| Queue | Spreading work across workers | "Each job goes to one worker" |
| Pub/sub | Broadcasting events | "Every subscriber gets every event" |
| Log (Kafka) | Durable, replayable streams | "Partitioned by entity ID for ordering" |
| Workers | Async and batch jobs | "Scale with queue depth" |

## Queue vs pub/sub vs log

These are often mixed up, and interviewers follow up on them.

| | Who gets a message | After delivery | Examples |
|---|---|---|---|
| **Queue** | One consumer | Deleted once acknowledged | SQS, RabbitMQ queues |
| **Pub/sub** | Every subscriber | Gone; offline subscribers may miss it | SNS, Redis Pub/Sub |
| **Log** | Every consumer *group*; within a group, one consumer per partition | Kept until retention ends, so it can be replayed | Kafka, Kinesis |

Kafka acts like pub/sub across consumer groups and like a queue within a
group. Order is kept only within a partition, so partition by the entity
whose order matters (`match_id`, `chat_id`).

Redis Pub/Sub is fire-and-forget. If a subscriber is down, it misses the
message. Use Redis Streams or Kafka when messages must not be lost.

## Split services by load profile

Split a service when its two jobs have very different load. Example: in a
live-scores system, ingesting updates (a few writes per second, bursty) and
holding millions of client connections are separate services. Connection
servers are stateful, so keep them thin and keep business logic elsewhere.

## Example

See the read and write flows in [url-shortener/design.md](../designs/url-shortener/design.md).

## Mistakes to avoid

- An empty database: nothing writes to it.
- One service doing two jobs with very different load profiles.
- Saying "queue" when you mean pub/sub.
- Over-engineering too early: Kafka, ten microservices or multi-region
  before anything works end to end.
- Drawing in silence. Narrate as you go.
