/** Small helpers shared by every widget's mock data provider. Nothing here
 * is meant to survive contact with a real API - it just makes the mock
 * providers feel alive (varied, deterministic-per-seed) without a dependency. */

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
