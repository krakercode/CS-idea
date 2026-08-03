import { load, Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("transit-settings.json", { autoSave: true });
  }
  return storePromise;
}

/**
 * Transitland API key for train/bus/ferry stop search + departures
 * (src-tauri/src/transit.rs) - free at transit.land, but a per-account
 * secret (unlike Spotify's public client ID) and required for every
 * request (unlike PokemonTCG's optional key), so it's user-supplied and
 * mandatory. Same storage shape as calendar/pandascoreKeyStore.ts.
 */
export async function getTransitlandKey(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>("transitlandApiKey")) ?? null;
}

export async function setTransitlandKey(apiKey: string): Promise<void> {
  const store = await getStore();
  await store.set("transitlandApiKey", apiKey);
  await store.save();
}
