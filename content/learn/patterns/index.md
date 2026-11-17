# Common patterns

Recurring problems and the usual ways to solve them. Each pattern combines
core concepts and key technologies, and most designs use two or three.

- [Real-time updates](real-time-updates.md): pushing changes to clients with WebSockets, SSE or polling.
- [Dealing with contention](dealing-with-contention.md): many users racing for the same seat, item or row.
- [Multi-step processes](multi-step-processes.md): sagas and workflows that survive failures halfway.
- [Scaling reads](scaling-reads.md): replicas, caches and CDNs for read-heavy systems.
- [Scaling writes](scaling-writes.md): sharding, batching and queues for write-heavy systems.
- [Handling large files](handling-large-files.md): uploads, downloads and processing of big blobs.
- [Long-running tasks](long-running-tasks.md): job queues, workers and progress tracking.
- [Adding an AI feature](adding-an-ai-feature.md): LLM calls, retrieval, cost and guardrails.
