import { load, Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("settings.json", { autoSave: true });
  }
  return storePromise;
}

export async function getApiKey(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>("apiKey")) ?? null;
}

export async function setApiKey(apiKey: string): Promise<void> {
  const store = await getStore();
  await store.set("apiKey", apiKey);
  await store.save();
}

export async function getRecentPlayers(): Promise<string[]> {
  const store = await getStore();
  return (await store.get<string[]>("recentPlayers")) ?? [];
}

export async function addRecentPlayer(playerId: string): Promise<string[]> {
  const store = await getStore();
  const current = (await store.get<string[]>("recentPlayers")) ?? [];
  const next = [playerId, ...current.filter((p) => p !== playerId)].slice(0, 8);
  await store.set("recentPlayers", next);
  await store.save();
  return next;
}
