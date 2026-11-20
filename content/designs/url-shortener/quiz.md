# URL Shortener quiz

## Roughly how many redirects are there for each link created?

- [ ] About 3
- [ ] About 30
- [x] About 300
- [ ] About 3,000

> 1B redirects a day is about 12K per second, and 100M new links a month is about 40 per second. That's roughly 300 to 1, so the read path is the one to optimise.

Review: [3. Estimation](design.md#3-estimation)

## Which of these does the design accept?

- [x] A new link taking about a second to work everywhere
- [ ] Two users briefly getting the same short code
- [x] Click counts running a few minutes behind
- [ ] A redirect taking half a second at p99

> Short codes must be unique, so creating them needs strong consistency, and redirects have a p99 target of 100 ms. A new link may take about a second to work everywhere, and click counts may lag a few minutes.

Review: [Non-functional](design.md#non-functional)

## What's the fewest base62 characters that give 6 billion links unique codes?

- [ ] 4
- [ ] 5
- [x] 6
- [ ] 7

> 62⁵ is about 916 million, too few. 62⁶ is about 57 billion, well above the 6B links that five years bring. The design uses 7 to leave headroom.

Review: [3. Estimation](design.md#3-estimation)

## Why does a key-value store partitioned by `short_code` fit the link data?

- [x] Nearly every read is "get by code"
- [ ] "List my links" works without an extra index
- [x] It has conditional writes, which keep codes unique
- [ ] All links fit on one node, so reads never cross shards

> There's one main access pattern, get by code, and creating a link needs a conditional write. About 3 TB of data spreads across shards keyed by code, and "List my links" needs a secondary index on `owner_id`.

Review: [4. Core entities](design.md#4-core-entities)

## Where are custom aliases stored?

- [ ] In a separate alias table, checked before the main one
- [x] As ordinary `short_code` values in the same table
- [ ] In the same table, in an `alias` column next to the generated code
- [ ] On the User row of the person who chose them

> One table gives one namespace and one uniqueness check, so an alias and a generated code can't both claim the same code.

Review: [4. Core entities](design.md#4-core-entities)

## Where does `POST /urls` get the link's owner from?

- [ ] An `owner_id` field in the request body
- [ ] The `Idempotency-Key` header
- [ ] The client's IP address
- [x] The auth token

> The owner always comes from the token. Trusting a field in the body would let anyone create links in someone else's name.

Review: [5. API design](design.md#5-api-design)

## Why does the redirect return 302 instead of 301?

- [ ] 302 responses are smaller and faster to follow
- [x] So repeat clicks still reach our servers and get counted
- [ ] Browsers block a 301 to another domain
- [ ] A 301 can't point to a custom alias

> A 301 lets browsers cache the redirect and skip our servers; a 302 isn't cached by default. That cuts traffic, but hides repeat clicks, and click counts are a requirement.

Review: [5. API design](design.md#5-api-design)

## What does `GET /{short_code}` return for a link that has expired?

- [ ] 404 Not Found
- [ ] 302 to the original URL until the row is deleted
- [ ] 403 Forbidden
- [x] 410 Gone

> 410 says the link existed but is no longer available. 404 is for codes that don't exist.

Review: [5. API design](design.md#5-api-design)

## Why are creating links and redirecting split into two services?

- [ ] Redirects need strong consistency; creating links doesn't
- [x] Their load is very different, so each scales on its own
- [ ] Creating links has to run in a separate region
- [ ] Redirects need a different database

> Creating runs at about 100 per second at peak and redirects at about 50K. Separate services let each one scale to its own load.

Review: [6. High-level design](design.md#6-high-level-design)

## A generated code is already taken by a custom alias. What does the URL service do?

- [ ] Returns 409 Conflict
- [ ] Overwrites the alias
- [x] Takes the next ID and tries again
- [ ] Adds a random character to the code

> The conditional put fails, so the service moves on to the next ID. 409 is only for a custom alias the user asked for that's already taken.

Review: [Create a short URL](design.md#create-a-short-url)

## Which of these can the redirect service check while answering a request?

- [x] Its small in-process cache
- [ ] The URL blocklist
- [x] Redis
- [ ] The per-user rate limit
- [x] The link's `expires_at`

> It looks in its in-process cache, then Redis, then the URL store on a miss. It answers 410 if `expires_at` has passed, and 302 otherwise. The blocklist and the rate limit are checked when a link is created.

Review: [Redirect](design.md#redirect)

## What are the downsides of making the code by hashing the long URL?

- [x] Collisions between hashes need checking
- [ ] Instances have to coordinate to hand out codes
- [x] Two users shortening the same URL get the same code
- [ ] Codes come out in order, so they're easy to guess

> Keeping 7 characters of a hash means two URLs can collide, and the same URL always hashes to the same code, whoever shortens it. Hashing needs no coordination, and its codes aren't sequential.

Review: [Deep dive 1: generating short codes](design.md#deep-dive-1-generating-short-codes)

## Why start the ID counter at 62⁶?

- [ ] So codes are hard to guess
- [x] Every code is then exactly 7 characters long
- [ ] So a crashed instance's block isn't wasted
- [ ] So the counter needs fewer atomic increments

> In base62, 62⁶ is the first number with 7 digits, so every code from there on is 7 characters.

Review: [Deep dive 1: generating short codes](design.md#deep-dive-1-generating-short-codes)

## Why might you switch from ID blocks to random codes?

- [x] Sequential codes let someone find other people's links by counting
- [ ] Random codes are shorter
- [ ] Two instances can hand out the same ID
- [ ] The counter can't keep up with 100 writes per second

> Codes from a counter are consecutive, so anyone can list links by counting upwards. Random codes with a conditional put fix that, and with only about 0.2% of the keyspace used, retries are rare.

Review: [Deep dive 1: generating short codes](design.md#deep-dive-1-generating-short-codes)

## A link goes viral. What stops its traffic from overloading one Redis shard?

- [x] A small in-process cache on each redirect server
- [ ] Caching "not found" for 10 seconds
- [ ] Jitter on cache TTLs
- [ ] Publishing clicks to Kafka

> Each redirect server keeps the link for about 60 seconds, so repeat hits are answered before they reach Redis.

Review: [Deep dive 2: fast redirects and viral links](design.md#deep-dive-2-fast-redirects-and-viral-links)

## What can the in-process cache get wrong for up to a minute?

- [ ] Redirecting a link after its `expires_at`
- [x] Redirecting a link the abuse scan has disabled
- [ ] Handing out a short code that's already taken
- [ ] Sending a click event to the wrong Kafka partition

> Each cached entry keeps `expires_at`, so expiry is checked even on a cache hit. Disabling a link deletes its Redis entry, but the copies in each redirect server's memory last until their 60-second TTL runs out.

Review: [Deep dive 2: fast redirects and viral links](design.md#deep-dive-2-fast-redirects-and-viral-links)

## Many hot cache entries expire and thousands of requests miss at once. Which of these protect the store?

- [ ] Per-user rate limits at the gateway
- [x] Request coalescing: one store read per code
- [ ] Caching "not found" codes for about 10 seconds
- [x] Jitter on TTLs

> Request coalescing sends one read per code to the store and shares the result. Jitter spreads expiry times, so many hot entries don't expire at the same moment.

Review: [Deep dive 2: fast redirects and viral links](design.md#deep-dive-2-fast-redirects-and-viral-links)

## Why does creating a link delete the code's "not found" cache entry?

- [ ] To free memory in Redis
- [ ] So scanners can't guess the new code
- [ ] To reset the code's click count
- [x] So the new link works at once, not after the entry expires

> Scanners trying random codes get "not found" cached for about 10 seconds. Without the delete, someone who just chose that alias would get a 404 until the entry expired.

Review: [Deep dive 2: fast redirects and viral links](design.md#deep-dive-2-fast-redirects-and-viral-links)

## A viral link puts all its click events on one Kafka partition. What's the fix?

- [ ] Drop click events once a link passes a traffic limit
- [ ] Write each click straight to the click-count table instead
- [x] Count in memory on each redirect server and send totals every few seconds
- [ ] Give the link a longer cache TTL

> Events are partitioned by `short_code`, so one link's clicks all land on one partition. Counting on the redirect servers sends a few totals instead of thousands of events.

Review: [Deep dive 3: counting clicks without slowing redirects](design.md#deep-dive-3-counting-clicks-without-slowing-redirects)

## Why are click counts only approximate?

- [x] At-least-once delivery can count a click twice
- [ ] Browsers cache the 302, so repeat clicks are missed
- [x] A crash can lose the last few seconds of batched counts
- [ ] Redis evicts counts when memory runs short

> The design accepts both, so counts are approximate. Browsers don't cache a 302 by default, which is why we use it, and counts aren't kept in Redis.

Review: [Deep dive 3: counting clicks without slowing redirects](design.md#deep-dive-3-counting-clicks-without-slowing-redirects)
