import { useCallback, useRef, useState } from 'react';

/** A pure transition: returns the SAME state object when the event is ignored. */
export type Transition<S extends object, E> = (state: S, event: E) => S;

/**
 * Runs a pure transition function as component state.
 *
 * `send` applies the event synchronously and returns the state the machine
 * moved to, or `null` when the transition ignored the event. An ignored event
 * is therefore also the lock against starting a side effect twice: a second
 * tap in the same frame sees `null` before React has rendered again.
 *
 * Catalog and conventions: docs/mobile-estados.md.
 */
export function useMachine<S extends object, E>(transition: Transition<S, E>, initial: S): readonly [S, (event: E) => S | null] {
  const [state, setState] = useState(initial);
  const current = useRef(initial);
  const send = useCallback((event: E) => {
    const next = transition(current.current, event);
    if (next === current.current) return null;
    current.current = next;
    setState(next);
    return next;
  }, [transition]);
  return [state, send];
}
