import { useCallback, useEffect, useRef } from 'react';

/**
 * Devuelve una función estable que agrupa llamadas consecutivas dentro de
 * `esperaMs` (útil para ráfagas de eventos Realtime). Cancela al desmontar.
 */
export function useDebouncedCallback(fn: () => void, esperaMs = 300): () => void {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(), esperaMs);
  }, [esperaMs]);
}
