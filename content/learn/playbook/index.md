# Playbook

Common problems in a design, such as too much traffic or two people wanting
the same thing, and the usual ways to solve them. Each page follows the
deep-dive structure from [step 7](../framework/07-deep-dives.md): the problem,
the options, a choice and its trade-off.

- [Too many reads](too-many-reads.md): the database can't keep up with lookups.
- [Too many writes](too-many-writes.md): one machine can't absorb the incoming data.
- [One key gets all the traffic](one-key-gets-all-the-traffic.md): a viral item overloads a single shard or cache node.
- [Two users want the same thing](two-users-want-the-same-thing.md): seats, stock or usernames that only one person can get.
- [Pushing updates live](pushing-updates-live.md): clients must see changes without refreshing.
- [Work that takes minutes](work-that-takes-minutes.md): jobs too slow to finish inside a request.
- [Steps that must all happen](steps-that-must-all-happen.md): a process across services that can fail halfway.
- [Huge files](huge-files.md): uploads and downloads too big for your servers.
- [Adding an LLM](adding-an-llm.md): a slow, costly, unpredictable dependency in the request path.
