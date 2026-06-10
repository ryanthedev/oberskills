/**
 * Bounded-concurrency task pool. Tasks are launched in submission order, at
 * most `concurrency` in flight; results are returned in submission order.
 * `shouldStop` is consulted before launching each task (budget-ledger aborts) —
 * skipped tasks resolve to { status: "skipped" }.
 *
 * Each task runs inside its own try/catch: a thrown task becomes a typed
 * { status: "failed" } outcome for that slot instead of rejecting the whole
 * pool (which would race callers' finally-cleanup against still-running
 * siblings). Callers turn failures into infra_error records.
 */
export type PoolOutcome<T> =
  | { status: "done"; value: T }
  | { status: "failed"; error: string }
  | { status: "skipped" };

export async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  shouldStop?: () => boolean,
): Promise<PoolOutcome<T>[]> {
  const results: PoolOutcome<T>[] = tasks.map(() => ({ status: "skipped" }));
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      if (shouldStop?.()) {
        results[index] = { status: "skipped" };
        continue;
      }
      const task = tasks[index];
      if (!task) continue;
      try {
        results[index] = { status: "done", value: await task() };
      } catch (e) {
        results[index] = { status: "failed", error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, tasks.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
