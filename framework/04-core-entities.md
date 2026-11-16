# 4. Core entities

**Time:** 2 min, plus fields added during the high-level design · **Output:** the nouns the system stores and exchanges

[← Back to the framework](../APPROACH.md#4-core-entities) · [← Estimation](03-estimation.md) · [Next: API design →](05-api-design.md)

## Why before the API

The API sends and receives these entities, so naming them first gives you the
vocabulary for the rest of the interview. Don't write the full schema yet. You
don't know which fields you need until you draw the flows.

## How to do it

1. List the nouns from the functional requirements.
2. Give each one its key fields only.
3. During the high-level design, write the fields each flow needs next to the database box.

Example (URL shortener):

| Entity | Key fields | Notes |
|---|---|---|
| ShortUrl | `short_code` (primary/partition key), `long_url`, `owner_id`, `created_at`, `expires_at` | Read on every redirect |
| User | `id`, `email` | Only if links have owners |
| Click | `short_code`, `timestamp`, `country` | Append-only; likely belongs in an analytics pipeline, not the main database |

## Modelling rules

### Current state vs history

Keep what changes in place apart from what only grows.

| Current state (updated in place) | History (append-only) |
|---|---|
| Match score | Match events (goal, card, substitution) |
| Account balance | Transactions |
| Order status | Order status changes |

History can be replayed to rebuild state, and you can partition it by time.

### Relationships

- **One-to-many:** a foreign key on the "many" side. A Comment has a `post_id`.
- **Many-to-many:** a join table. `Follow(follower_id, followee_id)`.
- **In NoSQL stores:** model around the queries, not the relationships.
  Duplicate data so each common query reads one partition.

### Justify every field

Every field needs a reason from a requirement or a design need:

| Field | Reason |
|---|---|
| `seq` / sequence number | Ordering; clients drop stale updates |
| `idempotency_key` | Retries don't create duplicates |
| `version` | Optimistic locking for concurrent edits |
| `expires_at` | TTL-based cleanup |

### Name the partition key

The partition key decides how data spreads across shards, and where hot spots
appear. Say it out loud and check it against your main query.

- Good: `short_code` for redirects. Lookups spread evenly.
- Risky: `match_id` during a cup final, or `user_id` for a celebrity. One key gets most of the traffic.

## Choosing a store

Default to one database. Split only with a concrete reason, such as a very different access pattern or scale.

| Need | Default choice | Why |
|---|---|---|
| Relations, transactions, uniqueness | Postgres / MySQL | ACID and constraints; read replicas take it further than most people expect |
| Huge key-value data, accessed by key | DynamoDB / Cassandra | Horizontal scale, predictable latency |
| Hot reads, counters, short-lived state | Redis | In memory |
| Large files | S3 + CDN | Cheap and durable |
| Full-text search | Elasticsearch / OpenSearch | Inverted index |
| Semantic search (embeddings) | pgvector or a dedicated vector database | Approximate nearest-neighbour search |
| Event stream that can be replayed | Kafka | Durable, ordered per partition |

## Mistakes to avoid

- A full 15-column schema at minute 10.
- Picking NoSQL "for scale" without naming the access pattern.
- Forgetting the partition key, then getting stuck on hot partitions in the deep dives.
- A join table for a one-to-many relationship.
