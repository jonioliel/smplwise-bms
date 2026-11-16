/**
 * CR-EDITORS-MEMO-2440 (review 06:PERF-3, PERF-6, RACE-6, RACE-7, MAPA-1): the four small guards the editors share. Pure (no DOM, no
 * Lit), so they run in node (tests/unit-editors-memo-2440.spec.ts).
 *
 *  - `KeyedMemo`      a derived value read many times per render is computed once per set of inputs;
 *  - `SingleFlight`   a refresh round never overlaps itself: one in flight and at most one waiting;
 *  - `OneAtATime`     a step that saves is not started again while it is still saving (a double click);
 *  - `NewestApplied`  of several reads of the same thing, an older answer never lands on top of a newer one.
 */
import { sameRefs } from '../map/memo';

/**
 * A value derived from a list of inputs, kept until one of the inputs is another object / value (`===`). The screens that use it
 * REPLACE their drafts, lists and filters (never edit them in place), so identity is enough and no fingerprint is paid for.
 * `clear()` forgets the value (the start of a Lit update, as `schedule-editor.ts` does for its validation).
 */
export class KeyedMemo<T> {
  private keys: readonly unknown[] | null = null;
  private value: T | undefined;

  get(keys: readonly unknown[], make: () => T): T {
    if (!sameRefs(this.keys, keys)) {
      this.value = make();
      this.keys = keys;
    }
    return this.value as T;
  }

  clear(): void {
    this.keys = null;
    this.value = undefined;
  }
}

/**
 * One round in flight and at most one waiting. A call while a round runs does not start a second one beside it: it waits for a
 * round that STARTS after the call (so it reads what the caller just wrote), and every further call made while that one waits
 * shares it. `merge` folds the arguments of the calls that share the waiting round (e.g. `recheck` of any of them).
 * A burst of N pushes while a round runs costs one extra round, not N; rounds never land out of order because they never overlap.
 * The round's own failure is the round's business (`run` resolves either way).
 */
export class SingleFlight<A = void> {
  private running: Promise<void> | null = null;
  private waiting: { arg: A; done: Promise<void> } | null = null;

  constructor(
    private readonly round: (arg: A) => Promise<void>,
    private readonly merge: (a: A, b: A) => A = (_a, b) => b,
  ) {}

  /** Whether a round is in flight now. */
  get busy(): boolean {
    return this.running !== null;
  }

  run(arg: A): Promise<void> {
    if (this.waiting) {
      this.waiting.arg = this.merge(this.waiting.arg, arg);
      return this.waiting.done;
    }
    if (!this.running) return this.start(arg);
    const slot: { arg: A; done: Promise<void> } = { arg, done: Promise.resolve() };
    slot.done = this.running.then(() => {
      this.waiting = null;
      return this.start(slot.arg);
    });
    this.waiting = slot;
    return slot.done;
  }

  private start(arg: A): Promise<void> {
    const p = (async () => {
      try {
        await this.round(arg);
      } catch {
        /* the round reports its own failure */
      }
    })().then(() => {
      if (this.running === p) this.running = null;
    });
    this.running = p;
    return p;
  }
}

/** One run at a time: a call made while the previous one is still running is dropped (`false`), not queued. */
export class OneAtATime {
  private active = false;

  get busy(): boolean {
    return this.active;
  }

  async run(fn: () => Promise<void>): Promise<boolean> {
    if (this.active) return false;
    this.active = true;
    try {
      await fn();
    } finally {
      this.active = false;
    }
    return true;
  }
}

/**
 * Several reads of the same thing in flight (the open of a detail and a push-driven refresh): an answer is applied unless a read
 * that began AFTER it was already applied. Unlike a "newest wins" counter, a newer read that fails does not discard the older
 * answer that is still on its way.
 *
 *     const land = this.detailReads.begin();
 *     const fresh = await getIt(id);
 *     if (this.id === id && land()) this.detail = fresh;
 */
export class NewestApplied {
  private seq = 0;
  private applied = 0;

  begin(): () => boolean {
    const mine = ++this.seq;
    return () => {
      if (mine < this.applied) return false;
      this.applied = mine;
      return true;
    };
  }
}
