import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long a hovered target stays emphasised after the pointer leaves it.
 *
 * Nodes are spaced apart, so crossing the board means repeatedly passing over
 * empty space. Clearing instantly on every gap makes the whole scene flash
 * between emphasised and not; holding the emphasis briefly means only a real
 * pause on empty space releases it.
 */
const GRACE_MS = 140;

/**
 * Hover state that survives moving straight from one target to the next: the
 * clear is deferred so the next target's enter can cancel it.
 */
export function useStableHover<T>() {
  const [id, setId] = useState<T | null>(null);
  const pending = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    }
  }, []);

  const enter = useCallback(
    (next: T) => {
      cancel();
      setId(next);
    },
    [cancel],
  );

  const leave = useCallback(() => {
    cancel();
    pending.current = window.setTimeout(() => {
      pending.current = null;
      setId(null);
    }, GRACE_MS);
  }, [cancel]);

  const clear = useCallback(() => {
    cancel();
    setId(null);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { id, enter, leave, clear };
}
