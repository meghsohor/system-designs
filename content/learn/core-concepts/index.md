# Core concepts

The ideas that come up in almost every design. Learn these first: the key
technologies and patterns build on them.

- [Networking essentials](networking-essentials.md): how a request travels, and when to pick HTTP, WebSockets or gRPC.
- [API design](api-design.md): resources, pagination, idempotency and versioning.
- [Data modeling](data-modeling.md): entities, relationships, and choosing a store for the access pattern.
- [Database indexing](database-indexing.md): B-trees, LSM trees, and what an index costs on writes.
- [Caching](caching.md): cache-aside, write-through, eviction, and keeping stale data in check.
- [Sharding and replication](sharding-and-replication.md): splitting data across machines and keeping copies in sync.
- [Consistent hashing](consistent-hashing.md): spreading keys so adding a node moves little data.
- [CAP and consistency models](cap-and-consistency.md): strong vs eventual, and choosing per feature.
- [Numbers to know](numbers-to-know.md): latency, throughput and storage figures for quick estimates.
