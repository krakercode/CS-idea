import { load, Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("pokemon-tcg-settings.json", { autoSave: true });
  }
  return storePromise;
}

/**
 * Optional pokemontcg.io API key - unlike PandaScore's, this source works
 * fully with no key at all (confirmed live: unauthenticated requests
 * succeed), a key just raises the rate limit. Same storage shape as
 * `calendar/pandascoreKeyStore.ts` regardless.
 */
export async function getPokemonTcgKey(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>("pokemonTcgApiKey")) ?? null;
}

export async function setPokemonTcgKey(apiKey: string): Promise<void> {
  const store = await getStore();
  await store.set("pokemonTcgApiKey", apiKey);
  await store.save();
}
