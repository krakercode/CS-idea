const STORAGE_KEY = "of-the-day-vegan";

/** Recipe of the Day's vegan/non-vegan toggle - a plain persisted boolean,
 * passed straight through to `fetch_of_the_day`'s `vegan` param. */
export function getVeganPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setVeganPreference(vegan: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(vegan));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}
