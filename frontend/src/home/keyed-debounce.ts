// Review 08:F21: a debounce that keeps one pending value and one timer PER KEY. The home screen saved every favourites list through a
// single timer, so two different lists changed within the delay lost the first write (the second change cancelled it).
// No DOM: the timer functions are passed in (the element gives `window`'s, the unit spec gives fake ones).

export interface DebounceTimers {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

interface KeyedDebounce<T> {
  /** Remembers `value` as the latest for `key` and (re)starts that key's delay; other keys are left alone. */
  push(key: string, value: T): void;
  /** Sends every pending value now, in the order the keys were first pushed, and stops their timers. */
  flush(): void;
  /** How many keys wait to be sent. */
  readonly pending: number;
}

export function keyedDebounce<T>(send: (key: string, value: T) => void, ms: number, timers: DebounceTimers): KeyedDebounce<T> {
  const waiting = new Map<string, { value: T; timer: number }>();
  const fire = (key: string) => {
    const w = waiting.get(key);
    if (!w) return;
    timers.clear(w.timer);
    waiting.delete(key);
    send(key, w.value);
  };
  return {
    push(key, value) {
      const prev = waiting.get(key);
      if (prev) { // the same key again: the newer value replaces the older, the key keeps its place in the sending order
        timers.clear(prev.timer);
        prev.value = value;
        prev.timer = timers.set(() => fire(key), ms);
        return;
      }
      waiting.set(key, { value, timer: timers.set(() => fire(key), ms) });
    },
    flush() {
      for (const key of [...waiting.keys()]) fire(key);
    },
    get pending() {
      return waiting.size;
    },
  };
}
