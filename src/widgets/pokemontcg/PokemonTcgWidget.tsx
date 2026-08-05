import { type FormEvent, useEffect, useState } from "react";
import { WidgetShell } from "../../shared/WidgetShell";
import { ViewSwitcher } from "../../shared/ViewSwitcher";
import { useWidgetViews } from "../../shared/useWidgetViews";
import { ExternalLink } from "../../shared/ExternalLink";
import { formatCurrency } from "../../shared/format";
import { getPokemonTcgKey, setPokemonTcgKey } from "./pokemonTcgKeyStore";
import { getCard, searchCards } from "./pokemonTcgService";
import {
  addToCollection,
  bestUnitPrice,
  getCollection,
  getTotalQuantity,
  getTotalValue,
  refreshSnapshot,
  removeFromCollection,
  setQuantity,
} from "./collectionStore";
import {
  addEntry,
  addPull,
  getEntries,
  getNetGainLoss,
  getTotalPulledValue,
  getTotalSpent,
  removeEntry,
  removePull,
} from "./spendStore";
import type { CollectionEntry, PokemonCard, SpendEntry } from "./types";
import "./PokemonTcgWidget.css";

const VIEWS = [
  { id: "prices", label: "Prices" },
  { id: "collection", label: "Collection" },
  { id: "spend", label: "Spend Tracker" },
  { id: "shopping", label: "Shopping" },
];

interface PullDraft {
  name: string;
  value: string;
  lookupResults: PokemonCard[];
  looking: boolean;
}

const EMPTY_PULL_DRAFT: PullDraft = { name: "", value: "", lookupResults: [], looking: false };

function priceRow(card: PokemonCard) {
  return (
    <div className="pokemontcg-widget__price-compare">
      <span>
        TCGPlayer:{" "}
        {card.tcgplayerPrice != null ? formatCurrency(card.tcgplayerPrice, "USD") : "—"}
        {card.tcgplayerVariant ? ` (${card.tcgplayerVariant})` : ""}
      </span>
      <span>Cardmarket: {card.cardmarketPrice != null ? formatCurrency(card.cardmarketPrice, "EUR") : "—"}</span>
    </div>
  );
}

/** Pokémon TCG: price comparison (TCGPlayer vs. Cardmarket, both embedded
 * in the same api.pokemontcg.io response), a Collection checklist, and a
 * pack/box spend tracker with per-pull value tracking. Collection/spend are
 * plain localStorage (see collectionStore.ts/spendStore.ts) - only the
 * price lookups hit the network. */
export function PokemonTcgWidget() {
  const { activeId, setActiveId, next, prev } = useWidgetViews(VIEWS);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [collection, setCollection] = useState<CollectionEntry[]>(() => getCollection());
  const [refreshingCollection, setRefreshingCollection] = useState(false);

  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>(() => getEntries());
  const [productDraft, setProductDraft] = useState("");
  const [costDraft, setCostDraft] = useState("");
  const [pullDrafts, setPullDrafts] = useState<Record<string, PullDraft>>({});

  useEffect(() => {
    getPokemonTcgKey().then((key) => {
      setApiKeyState(key);
      setKeyDraft(key ?? "");
    });
  }, []);

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault();
    const trimmed = keyDraft.trim();
    await setPokemonTcgKey(trimmed);
    setApiKeyState(trimmed || null);
    setShowSettings(false);
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await searchCards(trimmed, apiKey));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function handleAddToCollection(card: PokemonCard) {
    setCollection(addToCollection(card));
  }

  function handleSetQuantity(cardId: string, quantity: number) {
    setCollection(setQuantity(cardId, quantity));
  }

  function handleRemoveFromCollection(cardId: string) {
    setCollection(removeFromCollection(cardId));
  }

  async function handleRefreshCollection() {
    setRefreshingCollection(true);
    try {
      const refreshed = await Promise.all(collection.map((entry) => getCard(entry.cardId, apiKey)));
      refreshed.forEach((card, i) => {
        if (card) refreshSnapshot(collection[i].cardId, card);
      });
      setCollection(getCollection());
    } finally {
      setRefreshingCollection(false);
    }
  }

  function handleAddSpendEntry(e: FormEvent) {
    e.preventDefault();
    setSpendEntries(addEntry(productDraft, Number(costDraft)));
    setProductDraft("");
    setCostDraft("");
  }

  function updatePullDraft(entryId: string, patch: Partial<PullDraft>) {
    setPullDrafts((current) => ({ ...current, [entryId]: { ...(current[entryId] ?? EMPTY_PULL_DRAFT), ...patch } }));
  }

  async function handleLookupPullValue(entryId: string) {
    const draft = pullDrafts[entryId] ?? EMPTY_PULL_DRAFT;
    const name = draft.name.trim();
    if (!name) return;
    updatePullDraft(entryId, { looking: true });
    try {
      const results = await searchCards(name, apiKey);
      updatePullDraft(entryId, { lookupResults: results, looking: false });
    } catch {
      updatePullDraft(entryId, { looking: false });
    }
  }

  function selectLookupResult(entryId: string, card: PokemonCard) {
    const price = card.tcgplayerPrice ?? card.cardmarketPrice ?? 0;
    updatePullDraft(entryId, { name: card.name, value: String(price), lookupResults: [] });
  }

  function handleAddPull(entryId: string) {
    const draft = pullDrafts[entryId] ?? EMPTY_PULL_DRAFT;
    if (!draft.name.trim()) return;
    setSpendEntries(addPull(entryId, draft.name, Number(draft.value) || 0));
    setPullDrafts((current) => ({ ...current, [entryId]: EMPTY_PULL_DRAFT }));
  }

  function handleRemovePull(entryId: string, pullId: string) {
    setSpendEntries(removePull(entryId, pullId));
  }

  function handleRemoveSpendEntry(entryId: string) {
    setSpendEntries(removeEntry(entryId));
  }

  const headerActions = (
    <div className="pokemontcg-widget__header-actions">
      <ViewSwitcher views={VIEWS} activeId={activeId} onSelect={setActiveId} onNext={next} onPrev={prev} />
      <button
        type="button"
        className="widget-shell__icon-button"
        onClick={() => setShowSettings((v) => !v)}
        title="Pokémon TCG data source settings"
        aria-label="Pokémon TCG data source settings"
      >
        ⚙
      </button>
    </div>
  );

  const totalValue = getTotalValue(collection);
  const totalQuantity = getTotalQuantity(collection);
  const totalSpent = getTotalSpent(spendEntries);
  const totalPulledValue = getTotalPulledValue(spendEntries);
  const netGainLoss = getNetGainLoss(spendEntries);

  return (
    <WidgetShell title="Pokémon TCG" loading={false} error={null} headerActions={headerActions}>
      {showSettings && (
        <form className="pokemontcg-widget__settings" onSubmit={handleSaveKey}>
          <label htmlFor="pokemon-tcg-api-key">pokemontcg.io API key (optional)</label>
          <p className="pokemontcg-widget__settings-hint">
            Works with no key at all - a free key from{" "}
            <ExternalLink href="https://pokemontcg.io">pokemontcg.io</ExternalLink> just raises the rate limit.
          </p>
          <div className="pokemontcg-widget__settings-row">
            <input
              id="pokemon-tcg-api-key"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.currentTarget.value)}
              placeholder="Paste your API key"
            />
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {activeId === "prices" && (
        <div className="pokemontcg-widget__prices">
          <form className="pokemontcg-widget__search-form" onSubmit={handleSearch}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search card name…"
              className="pokemontcg-widget__search-input"
            />
            <button type="submit" disabled={searching}>
              {searching ? "…" : "Search"}
            </button>
          </form>

          {searchError && <p className="pokemontcg-widget__error">{searchError}</p>}
          {!searching && !searchError && searchResults.length === 0 && query.trim() && (
            <p className="pokemontcg-widget__empty">No matches.</p>
          )}

          <ul className="pokemontcg-widget__results">
            {searchResults.map((card) => {
              const owned = collection.find((e) => e.cardId === card.id);
              return (
                <li key={card.id} className="pokemontcg-widget__row">
                  {card.imageSmall && <img src={card.imageSmall} alt="" className="pokemontcg-widget__thumb" />}
                  <div className="pokemontcg-widget__row-info">
                    <span className="pokemontcg-widget__card-name">{card.name}</span>
                    <span className="pokemontcg-widget__card-meta">
                      {card.setName} · #{card.number}
                      {card.rarity ? ` · ${card.rarity}` : ""}
                    </span>
                    {priceRow(card)}
                  </div>
                  <button
                    type="button"
                    className="pokemontcg-widget__add-button"
                    onClick={() => handleAddToCollection(card)}
                  >
                    {owned ? `Owned ×${owned.quantity} +` : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activeId === "collection" && (
        <div className="pokemontcg-widget__collection">
          <div className="pokemontcg-widget__collection-summary">
            <span>
              {collection.length} unique · {totalQuantity} total
            </span>
            <span>Est. value: {formatCurrency(totalValue, "USD")}</span>
            <button type="button" onClick={() => void handleRefreshCollection()} disabled={refreshingCollection || collection.length === 0}>
              {refreshingCollection ? "Refreshing…" : "Refresh prices"}
            </button>
          </div>

          {collection.length === 0 && (
            <p className="pokemontcg-widget__empty">No cards yet - add some from the Prices tab.</p>
          )}

          <ul className="pokemontcg-widget__results">
            {collection.map((entry) => (
              <li key={entry.cardId} className="pokemontcg-widget__row">
                {entry.card.imageSmall && (
                  <img src={entry.card.imageSmall} alt="" className="pokemontcg-widget__thumb" />
                )}
                <div className="pokemontcg-widget__row-info">
                  <span className="pokemontcg-widget__card-name">{entry.card.name}</span>
                  <span className="pokemontcg-widget__card-meta">
                    {entry.card.setName} · #{entry.card.number}
                  </span>
                  <span className="pokemontcg-widget__card-meta">
                    Unit: {bestUnitPrice(entry) != null ? formatCurrency(bestUnitPrice(entry) as number, "USD") : "—"}
                  </span>
                </div>
                <div className="pokemontcg-widget__qty-stepper">
                  <button type="button" onClick={() => handleSetQuantity(entry.cardId, entry.quantity - 1)} aria-label="Decrease quantity">
                    −
                  </button>
                  <span>{entry.quantity}</span>
                  <button type="button" onClick={() => handleSetQuantity(entry.cardId, entry.quantity + 1)} aria-label="Increase quantity">
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="pokemontcg-widget__remove"
                  onClick={() => handleRemoveFromCollection(entry.cardId)}
                  aria-label={`Remove ${entry.card.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeId === "spend" && (
        <div className="pokemontcg-widget__spend">
          <div className="pokemontcg-widget__spend-summary">
            <span>Spent: {formatCurrency(totalSpent, "USD")}</span>
            <span>Pulled: {formatCurrency(totalPulledValue, "USD")}</span>
            <span
              className={`pokemontcg-widget__net ${
                netGainLoss >= 0 ? "pokemontcg-widget__net--positive" : "pokemontcg-widget__net--negative"
              }`}
            >
              Net: {netGainLoss >= 0 ? "+" : ""}
              {formatCurrency(netGainLoss, "USD")}
            </span>
          </div>

          <form className="pokemontcg-widget__spend-form" onSubmit={handleAddSpendEntry}>
            <input
              type="text"
              value={productDraft}
              onChange={(e) => setProductDraft(e.target.value)}
              placeholder="Product (e.g. Booster Box)"
              className="pokemontcg-widget__product-input"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={costDraft}
              onChange={(e) => setCostDraft(e.target.value)}
              placeholder="Cost"
              className="pokemontcg-widget__cost-input"
            />
            <button type="submit">Log purchase</button>
          </form>

          {spendEntries.length === 0 && <p className="pokemontcg-widget__empty">No purchases logged yet.</p>}

          <ul className="pokemontcg-widget__spend-list">
            {spendEntries.map((entry) => {
              const draft = pullDrafts[entry.id] ?? EMPTY_PULL_DRAFT;
              const entryPulledValue = entry.pulls.reduce((sum, p) => sum + p.value, 0);
              return (
                <li key={entry.id} className="pokemontcg-widget__spend-entry">
                  <div className="pokemontcg-widget__spend-entry-header">
                    <span>
                      {entry.date} · {entry.product}
                    </span>
                    <span>{formatCurrency(entry.cost, "USD")}</span>
                    <button
                      type="button"
                      className="pokemontcg-widget__remove"
                      onClick={() => handleRemoveSpendEntry(entry.id)}
                      aria-label={`Remove ${entry.product} entry`}
                    >
                      ✕
                    </button>
                  </div>

                  {entry.pulls.length > 0 && (
                    <ul className="pokemontcg-widget__pulls">
                      {entry.pulls.map((pull) => (
                        <li key={pull.id} className="pokemontcg-widget__pull">
                          <span>{pull.cardName}</span>
                          <span>{formatCurrency(pull.value, "USD")}</span>
                          <button
                            type="button"
                            className="pokemontcg-widget__remove"
                            onClick={() => handleRemovePull(entry.id, pull.id)}
                            aria-label={`Remove pull ${pull.cardName}`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="pokemontcg-widget__pull-form">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => updatePullDraft(entry.id, { name: e.target.value })}
                      placeholder="Card name"
                      className="pokemontcg-widget__pull-name-input"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.value}
                      onChange={(e) => updatePullDraft(entry.id, { value: e.target.value })}
                      placeholder="Value"
                      className="pokemontcg-widget__pull-value-input"
                    />
                    <button type="button" onClick={() => void handleLookupPullValue(entry.id)} disabled={draft.looking}>
                      🔍
                    </button>
                    <button type="button" onClick={() => handleAddPull(entry.id)}>
                      Add pull
                    </button>
                  </div>

                  {draft.lookupResults.length > 0 && (
                    <ul className="pokemontcg-widget__lookup-results">
                      {draft.lookupResults.map((card) => (
                        <li key={card.id}>
                          <button type="button" onClick={() => selectLookupResult(entry.id, card)}>
                            {card.name} ({card.setName}) —{" "}
                            {card.tcgplayerPrice != null ? formatCurrency(card.tcgplayerPrice, "USD") : "no price"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="pokemontcg-widget__spend-entry-footer">
                    Pulled: {formatCurrency(entryPulledValue, "USD")}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {activeId === "shopping" && (
        <div className="pokemontcg-widget__shopping">
          <div className="pokemontcg-widget__shopping-bar">
            <span className="pokemontcg-widget__shopping-note">
              Embedded from TCGCompare.com - price comparisons across 1,000+ retailers for boosters, singles and
              more. Some sites block being framed like this, so if nothing loads below, use this instead:
            </span>
            <ExternalLink href="https://tcgcompare.com" className="pokemontcg-widget__shopping-link">
              Open in browser ↗
            </ExternalLink>
          </div>
          <iframe
            src="https://tcgcompare.com"
            title="TCGCompare"
            className="pokemontcg-widget__shopping-frame"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </WidgetShell>
  );
}
