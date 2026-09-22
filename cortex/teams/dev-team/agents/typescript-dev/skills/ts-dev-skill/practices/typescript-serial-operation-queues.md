# TypeScript Serial Operation Queues

Use Effect v3 for authored serial workflows. Keep scheduling in TypeScript and
portable product policy in Rust. External Promise APIs belong only at adapters;
do not build an internal Promise-tail failure model alongside Effect.

## Keep the queue and results typed

Use an Effect Queue with one scoped consumer for FIFO execution. Each submitted
operation has its own Deferred completion; the caller receives that operation's
success or typed failure. Do not expose a mutable tail or run effects internally.

**Prohibited:** application scheduling owns a second failure model.

```ts
// Inside an application queue owner:
private tail: Promise<void> = Promise.resolve();

enqueue(operation: WriteOperation): Promise<void> {
  const next = this.tail.then(() => Effect.runPromise(operation));
  this.tail = next.catch(() => {});
  return next;
}
```

**Preferred:** queue admission and completion stay in Effect.
These fragments use an existing concrete `WriteFailure`. `pending` is a private
`Queue.Queue<WriteJob>` owned by the scheduler; service dependencies have already
been provided to the submitted operation.

```ts
import { Deferred, Effect, Queue } from "effect";

type WriteOperation = Effect.Effect<void, WriteFailure>;
type WriteCompletion = Deferred.Deferred<void, WriteFailure>;

interface WriteJob {
  readonly operation: WriteOperation;
  readonly completion: WriteCompletion;
}

// Inside the scheduler:
enqueue(operation: WriteOperation): WriteOperation {
  const pending = this.pending;
  return Effect.gen(function* () {
    const completion = yield* Deferred.make<void, WriteFailure>();
    const job: WriteJob = { operation, completion };
    yield* Queue.offer(pending, job);
    yield* Deferred.await(completion);
  });
}
```

Executing the returned effect admits the job; calling `enqueue` alone does not.
FIFO means admission order. Use an appropriate capacity/backpressure policy;
keep richer schedulers when priorities, cancellation, expiry, or closing require it.

## Report failure without stopping later work

Do not let one operation's expected failure terminate the consumer. Complete
that operation's Deferred with its Exit so its caller observes the original
failure while the consumer can take the next job.

**Prohibited:** the consumer fails before publishing completion.

```ts
const job = yield* Queue.take(pending);
yield* job.operation;
yield* Deferred.succeed(job.completion, void 0);
```

**Preferred:** capture the outcome and publish it to that job's caller.

```ts
// Inside the scheduler; invoke sequentially from its single consumer.
runNext(): Effect.Effect<void> {
  const pending = this.pending;
  return Effect.gen(function* () {
    const job = yield* Queue.take(pending);
    const outcome = yield* Effect.exit(job.operation);
    yield* Deferred.done(job.completion, outcome);
  });
}
```

These methods illustrate admission and completion, not a complete scheduler.
Own the consumer with Scope/forkScoped. Shutdown must also interrupt or complete
all outstanding Deferreds, including the in-flight job; Queue.shutdown alone
only wakes queue waiters. Do not leave admitted callers waiting forever.

## Define idle and recovery explicitly

If the API needs `onIdle`, enqueue an ordered barrier. Its completion means all
jobs admitted before it have finished, even if some failed. It does not promise
that concurrent producers have stopped. A live barrier has no job-failure channel;
scope cancellation still interrupts it.

**Prohibited:** check that the pending queue is empty while a job is still running.

**Preferred:** process a barrier after preceding jobs through the same single
consumer and complete its Deferred only when the barrier is reached.

Do not reset by replacing a tail and abandoning callers. Recovery must settle or
interrupt admitted jobs and release the old scoped consumer before admitting work
into a replacement owner. Promise adaptation remains at host/runtime boundaries.

## Validation

- Verify FIFO admission, one active operation, and each caller's own typed result.
- Verify a failed job does not prevent the next job from completing.
- Verify idle barriers wait for in-flight work, not just an empty pending queue.
- Verify cancellation, shutdown, and recovery leave no stranded callers or workers.
- Type-check against the project's Effect v3 version and run focused behavior tests.

See Effect v3's [Queue](https://effect.website/docs/v3/concurrency/queue) and
[Deferred](https://effect.website/docs/v3/concurrency/deferred) contracts.
