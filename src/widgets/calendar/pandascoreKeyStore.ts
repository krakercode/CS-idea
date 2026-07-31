import { load, Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("calendar-settings.json", { autoSave: true });
  }
  return storePromise;
}

/**
 * PandaScore API key for esports/CS2 match data (src-tauri/src/pandascore.rs)
 * - free to obtain at pandascore.co, but is a per-account secret (unlike
 * Spotify's public client ID), so it's user-supplied and stored locally
 * rather than baked into the app. Same plaintext-JSON-on-disk tradeoff as
 * the Leetify API key (see cs2db/analysis/settingsStore.ts).
 */
export async function getPandaScoreKey(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>("pandascoreApiKey")) ?? null;
}

export async function setPandaScoreKey(apiKey: string): Promise<void> {
  const store = await getStore();
  await store.set("pandascoreApiKey", apiKey);
  await store.save();
}
