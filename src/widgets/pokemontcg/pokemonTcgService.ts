import { invoke } from "@tauri-apps/api/core";
import type { PokemonCard } from "./types";

export function searchCards(query: string, apiKey: string | null): Promise<PokemonCard[]> {
  return invoke("search_pokemon_cards", { query, apiKey: apiKey || null });
}

export function getCard(cardId: string, apiKey: string | null): Promise<PokemonCard | null> {
  return invoke("get_pokemon_card", { cardId, apiKey: apiKey || null });
}
