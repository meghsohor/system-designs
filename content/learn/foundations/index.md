# Foundations

Ideas like consistency, indexing and caching that come up in almost every
design. They follow the order of the [interview framework](../framework/index.md),
and each page names the step where it's used.

- [Consistency and availability](consistency-and-availability.md): Step 2. Deciding what may be stale and what must never be.
- [Numbers worth remembering](numbers-worth-remembering.md): Step 3. Latencies, throughputs and sizes for quick estimates.
- [Modelling data](modelling-data.md): Step 4. Entities and relationships, starting from how the data is read.
- [Indexes](indexes.md): Step 4. How lookups get fast, and what that costs every write.
- [APIs and protocols](apis-and-protocols.md): Step 5. REST, gRPC, WebSockets and SSE, and when each one fits.
- [Partitioning and replication](partitioning-and-replication.md): Step 6. Splitting data across machines and keeping copies in sync.
- [Caching strategies](caching-strategies.md): Step 7. Cache-aside, write-through, eviction, and keeping stale data in check.
