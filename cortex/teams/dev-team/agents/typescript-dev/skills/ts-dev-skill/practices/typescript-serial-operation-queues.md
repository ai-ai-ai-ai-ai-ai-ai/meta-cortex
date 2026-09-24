# TypeScript Serial Operation Queues

Use Effect for authored serial workflows. Keep scheduling in TypeScript and
portable product policy in its domain owner, which is Rust in Rust/WASM projects.
External Promise APIs belong only at adapters;
do not build an internal Promise-tail failure model alongside Effect.

## Keep the queue and results typed

Use an Effect Queue with one scoped consumer for FIFO execution. Each submitted
operation has its own Deferred completion; the caller receives that operation's
success or typed failure. Do not expose a mutable tail or run effects internally.

Use the [upstream Effect guidance](../SKILL.md#effect-use-installed-documentation)
and the installed Queue, Deferred, and Scope APIs for implementation. This
practice owns the scheduling contract; it does not supply a second Effect recipe.

FIFO means admission order. Use an appropriate capacity/backpressure policy;
keep richer schedulers when priorities, cancellation, expiry, or closing require it.
Handle rejected admission before awaiting a job's Deferred: no consumer will
receive an unsubmitted job. Verify rejection behavior against the installed
Queue API, the selected capacity strategy, and shutdown. Keep rejection in the
domain failure channel.

## Report failure without stopping later work

Do not let one operation's expected failure terminate the consumer. Complete
that operation's Deferred with its Exit so its caller observes the original
failure while the consumer can take the next job.

Own the consumer with its resource scope. Shutdown must also interrupt or complete
all outstanding Deferreds, including the in-flight job; Queue.shutdown alone
only wakes queue waiters. Do not leave admitted callers waiting forever.

## Define idle and recovery explicitly

If the API needs `onIdle`, enqueue an ordered barrier. Its completion means all
jobs admitted before it have finished, even if some failed. It does not promise
that concurrent producers have stopped. A live barrier has no job-failure channel;
scope cancellation still interrupts it.

- **Prohibited:** check that the pending queue is empty while a job is still running.

- **Preferred:** process a barrier after preceding jobs through the same single
  consumer and complete its Deferred only when the barrier is reached.

Do not reset by replacing a tail and abandoning callers. Recovery must settle or
interrupt admitted jobs and release the old scoped consumer before admitting work
into a replacement owner. Promise adaptation remains at host/runtime boundaries.

## Validation

- Verify FIFO admission, one active operation, and each caller's own typed result.
- Verify rejected admission fails promptly without awaiting an unsubmitted job.
- Verify a failed job does not prevent the next job from completing.
- Verify idle barriers wait for in-flight work, not just an empty pending queue.
- Verify cancellation, shutdown, and recovery leave no stranded callers or workers.
- Type-check against the project's pinned Effect version and run focused behavior tests.
