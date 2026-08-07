const TIME_API_URL = "https://timeapi.io/api/time/current/zone?timeZone=UTC";
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * "Precision Mode" - the device's own clock can be wrong (unset, drifted,
 * a VM with a stalled clock) with nothing in a browser able to fix that
 * directly; there's no Web API for querying NTP/an atomic clock straight
 * from JS. The next best thing: ask a keyless, CORS-open HTTPS time
 * service (timeapi.io, itself ultimately NTP-synced) for the current UTC
 * instant, and derive a local-clock offset from it - the same
 * offset-correction idea NTP itself uses, just over HTTP instead of the
 * NTP protocol. Always requests the UTC zone specifically (not the
 * browser's own) so the response's `dateTime` string is unambiguous once
 * a trailing "Z" is appended - no local-vs-UTC parsing guesswork.
 */
export async function fetchNetworkTimeOffsetMs(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const requestStart = Date.now();
  let res: Response;
  try {
    res = await fetch(TIME_API_URL, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timed out - check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const requestEnd = Date.now();

  if (!res.ok) throw new Error(`Time sync failed (${res.status}).`);
  const data = (await res.json()) as { dateTime: string };

  // `dateTime` looks like "2026-08-07T12:33:41.0219502" - truncate to
  // millisecond precision (JS Date can't represent more anyway) and force
  // UTC interpretation, since the string itself carries no zone suffix.
  const serverMs = Date.parse(`${data.dateTime.slice(0, 23)}Z`);
  if (Number.isNaN(serverMs)) throw new Error("Time sync returned an unreadable timestamp.");

  // The response describes the instant the server sent it, not the instant
  // we asked - split the round trip evenly between request and response as
  // a simple, standard latency estimate (real NTP does the same in spirit).
  const roundTripMs = requestEnd - requestStart;
  const localAtServerMoment = requestStart + roundTripMs / 2;
  return serverMs - localAtServerMoment;
}
