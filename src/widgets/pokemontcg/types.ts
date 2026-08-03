export interface PokemonCard {
  id: string;
  name: string;
  setName: string;
  number: string;
  rarity: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  tcgplayerPrice: number | null;
  tcgplayerVariant: string | null;
  tcgplayerUrl: string | null;
  cardmarketPrice: number | null;
  cardmarketUrl: string | null;
}

/** A card the user owns - `card` is a snapshot of price/image/etc. from
 * whenever it was added or last refreshed, not a live value. */
export interface CollectionEntry {
  cardId: string;
  quantity: number;
  card: PokemonCard;
  addedAt: string; // ISO timestamp
}

/** One card pulled from a pack/box purchase. `value` is always a plain
 * number the user can edit, whether it was typed by hand or filled in from
 * a price lookup - there's no live link back to the card's current price. */
export interface PullEntry {
  id: string;
  cardName: string;
  value: number;
  cardId?: string;
}

export interface SpendEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  product: string;
  cost: number;
  pulls: PullEntry[];
}
