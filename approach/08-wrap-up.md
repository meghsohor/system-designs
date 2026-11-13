# 8. Wrap-up

**Time:** 1–2 min, optional · **Output:** a short summary and what you'd do next

[← Back to the framework](../APPROACH.md#8-wrap-up) · [← Deep dives](07-deep-dives.md)

## When to do it

Deep dives often use up the last minutes, and that's fine. If time is short,
give a one-sentence summary. If the interviewer moves to their questions,
follow them.

## How to do it

1. **Summarize in 3–4 sentences:** the shape of the system, the two or three
   key choices, and why.
2. **Say what breaks first at 10× load,** and what you'd do about it.
3. **Mention what you'd add with more time:** monitoring and alerts,
   multi-region, abuse prevention, analytics.

## Example (URL shortener)

> "It's a read-heavy key-value system. Writes go through a stateless service
> that generates a base62 code from a distributed ID and stores it in a store
> partitioned by short code. Redirects are served from a cache in front of
> that store, which absorbs most of the 12K reads per second. At 10× load,
> the first thing to break is the cache on viral links, so I'd add a small
> in-process cache for hot keys. With more time I'd add malicious-URL
> scanning and a proper analytics pipeline for clicks."

## Mistakes to avoid

- Bringing up a big new idea you can't finish.
- Repeating the whole design step by step.
- Ending on silence. Close with a clear sentence, then hand back to the interviewer.
