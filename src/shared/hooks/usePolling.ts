import { useCallback, useEffect, useRef, useState } from "react";

export interface PollingState<T> {
  /** Last successfully fetched value. Stays populated across a failed
   * background refresh so the widget doesn't blank out on a transient error. */
  data: T | null;
  /** Set when the most recent fetch attempt failed. Cleared on next success. */
  error: string | null;
  /** True only while waiting on the very first fetch (no data yet). */
  loading: boolean;
  /** Manually trigger an immediate refetch, resetting the interval timer. */
  refresh: () => void;
}

/**
 * Fetches once on mount, then again every `intervalMs`, until the component
 * unmounts. Every widget service is async so this hook is the one place
 * that turns "a function returning a promise" into live, auto-refreshing UI
 * state - swapping a mock service for a real API later needs no changes here.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const requestIdRef = useRef(0);

  const runFetch = useCallback(() => {
    const requestId = ++requestIdRef.current;
    fetcherRef
      .current()
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load data.");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    runFetch();
    const id = setInterval(runFetch, intervalMs);
    return () => clearInterval(id);
  }, [runFetch, intervalMs]);

  return { data, error, loading, refresh: runFetch };
}
