# 2. Requirements

**Time:** 5 min · **Output:** 3 functional requirements, 3–5 quantified non-functional requirements, an out-of-scope list

[← Back to the framework](index.md#2-requirements) · [← Understand](01-understand.md) · [Next: Estimation →](03-estimation.md)

## Functional requirements

What users can do.

- Walk through the user journey step by step. Each step a user takes is a
  candidate requirement.
- Write them as "Users can …".
- **Keep the top 3.** Each one becomes at least one API endpoint and one path
  through the diagram, so every extra requirement costs time you need later.
  Park the rest under out of scope.

Example (URL shortener):

1. Users can create a short URL from a long URL, optionally with a custom alias and an expiry date.
2. Users can open a short URL and be redirected to the original.
3. Users can see how many clicks a link got. *(stretch goal)*

## Non-functional requirements

How well it must work. Pick the 3–5 that matter for *this* system, and put a
number on each.

| Quality | Question to ask | Vague | Concrete |
|---|---|---|---|
| Scale | How many users, requests, how much data? | "Handles lots of traffic" | "100M new URLs/month, 1B redirects/day" |
| Latency | Which operation, which percentile? | "Fast" | "Redirect p99 < 100 ms" |
| Availability | What happens when it's down? | "Highly available" | "99.99% for redirects; link creation can degrade" |
| Consistency | What goes wrong if a read is stale? | "Consistent" | "Short codes must be unique; click counts may lag a few minutes" |
| Durability | Can we ever lose data? | "Reliable" | "A created link is never lost" |
| Ordering | Does order matter, and per what? | "In order" | "Messages ordered per chat, not globally" |
| Abuse | Who might misuse it? | "Secure" | "Block known-malicious URLs; rate-limit creation per user" |
| Cost | Is there a budget? | — | "LLM cost under $X per 1,000 requests" |

## Consistency per feature, not per system

**CAP:** during a network partition, a distributed system must choose between
consistency (every read sees the latest write) and availability (every request
gets an answer). Make that choice for each feature:

| Feature | Choice | Why |
|---|---|---|
| Seat booking, payments, unique usernames | Strong | A stale read means double-booking or duplicates |
| Feeds, likes, view counts, search index | Eventual | A few seconds of staleness hurts nobody |

**PACELC** adds the everyday case: even without a partition, you trade
**latency** against **consistency**. That's why reading from a replica is
faster but can return stale data.

## Ordering is not strong consistency

You can guarantee order **per entity** (per chat, per match, per account) and
still choose availability. The usual tools:

- Partition by the entity ID, so one entity's events go through one ordered partition.
- Attach a sequence number, so clients can drop or reorder late events.

## Out of scope

Say it out loud: "I'll leave out auth, admin tools and analytics dashboards
unless you want them." The interviewer can pull something back in. Saying
nothing makes it look like you forgot.

## Mistakes to avoid

- Vague NFRs like "scalable, available, fast". Each needs a number and an operation.
- A long list of functional requirements you won't have time to design.
- Choosing strong consistency everywhere "to be safe". It costs latency and availability.
- Forgetting something the prompt mentioned. Re-read it before moving on.
