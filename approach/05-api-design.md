# 5. API design

**Time:** 3–5 min · **Output:** one endpoint or event per functional requirement

[← Back to the framework](../APPROACH.md#5-api-design) · [← Core entities](04-core-entities.md) · [Next: High-level design →](06-high-level-design.md)

## How to do it

- Write one endpoint or event per functional requirement.
- Show the method, path, key request fields and response. Skip the rest.
- You can do this while drawing, by labeling arrows.

## Pick the protocol

Default to REST. Pick something else only with a reason.

| Protocol | Use when |
|---|---|
| REST | The default for client-facing CRUD |
| GraphQL | Many clients need very different shapes of the same data |
| gRPC | Internal service-to-service calls where latency matters |
| WebSocket | Both sides send messages in real time (chat, multiplayer) |
| SSE (server-sent events) | Only the server pushes (live scores, LLM token streaming) |
| Long polling | Fallback when WebSocket/SSE isn't available |
| Webhook | Notifying a third party's server |

## Conventions that interviewers notice

- **Plural nouns:** `/urls`, `/users/{id}/posts`.
- **User from the auth token, never the body.** Putting `user_id` in a body
  lets anyone act as anyone.
- **Cursor pagination** for lists and feeds. Offset pagination gets slow on
  large tables and skips or repeats items when new ones arrive.
- **Idempotency keys** on writes that clients retry (payments, orders).
- **Rate limiting** at the gateway, especially on write endpoints.

## Example (URL shortener)

```http
POST /urls
Authorization: Bearer <token>
Idempotency-Key: <uuid>

{ "long_url": "https://example.com/very/long", "custom_alias": "optional", "expires_at": "optional" }

→ 201 Created
{ "short_url": "https://sho.rt/abc123" }
```

```http
GET /{short_code}

→ 302 Found
Location: https://example.com/very/long
```

A trade-off worth saying out loud: **301** (permanent) lets browsers cache the
redirect, so fewer requests reach you, but you lose click counts. **302**
(temporary) sends every click through you, which keeps analytics working.

## Events for async systems

For event-driven parts, name the topic and the payload the same way:

```text
topic: match.updated   (partition key: match_id)
{ "match_id": "...", "seq": 42, "type": "goal", "minute": 67, "score": "2-1" }
```

## Mistakes to avoid

- `user_id` in the request body.
- Offset pagination on a feed.
- Endpoints that don't map to a functional requirement.
- Listing every field. Key fields are enough.
