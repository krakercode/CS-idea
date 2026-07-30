/** Small helpers shared by every widget's mock data provider. Nothing here
 * is meant to survive contact with a real API - it just makes the mock
 * providers feel alive (varied, deterministic-per-seed) without a dependency. */

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deterministic string -> number hash, used to seed a PRNG per entity
 * (symbol, topic, map name, ...) so mock values stay stable across renders
 * but still differ between entities. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG - tiny, seedable, good enough for fake demo data. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
