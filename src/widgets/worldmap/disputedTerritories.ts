/**
 * Territories whose sovereignty is genuinely contested, limited to ones
 * that are also their own separately-selectable polygon in this dataset
 * (Natural Earth's Admin-0 countries layer, via world-atlas) - keyed by
 * that polygon's exact `properties.name` string, not built up from a
 * separate disputed-areas dataset. This deliberately leaves out disputes
 * that don't get their own polygon at this resolution (Crimea is drawn as
 * part of Ukraine's outline here; Gibraltar, the Kuril Islands, and
 * Ceuta/Melilla are too small to appear as distinct shapes at 1:50m) -
 * better to say nothing than to claim a precision this data doesn't have.
 *
 * Every note below is deliberately just the widely-documented facts (who
 * administers it, who claims it, roughly how many states recognize what)
 * without taking a position on any of them - the same "here's what's
 * reported, judge for yourself" stance the News/Situation Monitor widgets
 * already take toward their own sources.
 */
export interface DisputedInfo {
  status: string;
  note: string;
}

export const DISPUTED_TERRITORIES: Record<string, DisputedInfo> = {
  Kosovo: {
    status: "Partially recognized",
    note: "Declared independence from Serbia in 2008. Recognized by over 100 of the 193 UN member states; not recognized by Serbia, Russia, China, or five EU members including Spain. Not a UN member.",
  },
  "N. Cyprus": {
    status: "Recognized only by Turkey",
    note: "The Turkish Republic of Northern Cyprus declared independence from Cyprus in 1983 and is recognized only by Turkey. The rest of the international community, including the UN, considers it part of the Republic of Cyprus.",
  },
  Somaliland: {
    status: "Recognized by one UN member state",
    note: "Declared independence from Somalia in 1991 and functions as a de facto state, but is considered part of Somalia by the UN and most countries. Israel recognized it as sovereign in January 2026, becoming the first UN member state to do so.",
  },
  Palestine: {
    status: "UN observer state",
    note: "A non-member observer state at the UN since 2012, recognized as sovereign by roughly 140-150 of 193 UN member states. Not recognized by the United States, Israel, and others; borders and final status remain disputed.",
  },
  Taiwan: {
    status: "De facto independent, disputed",
    note: "Self-governs as the Republic of China since 1949. The People's Republic of China claims it as part of its territory. Around a dozen UN member states maintain formal diplomatic relations with Taiwan; most others, including the US, maintain unofficial ties under a \"One China\" policy.",
  },
  "W. Sahara": {
    status: "UN Non-Self-Governing Territory",
    note: "Most of the territory is controlled and claimed by Morocco. The Polisario Front's Sahrawi Arab Democratic Republic claims the whole territory and is recognized by roughly 40-45 states, mostly in Africa and Latin America. Listed by the UN as a Non-Self-Governing Territory.",
  },
  "Siachen Glacier": {
    status: "Disputed military-controlled zone",
    note: "A high-altitude zone disputed between India and Pakistan since fighting began in 1984, part of the broader Kashmir dispute. India controls most of the glacier; both countries maintain permanent military posts here.",
  },
  "Indian Ocean Ter.": {
    status: "Disputed - ICJ opinion favors Mauritius",
    note: "Part of the Chagos Archipelago, administered by the UK as the British Indian Ocean Territory since 1965. A 2019 ICJ advisory opinion and a UN General Assembly resolution found the UK's separation of the islands from Mauritius unlawful and called for their return; the UK maintained administration until a 2025 agreement to transfer sovereignty to Mauritius while retaining the Diego Garcia military base.",
  },
  "Br. Indian Ocean Ter.": {
    status: "Disputed - ICJ opinion favors Mauritius",
    note: "The British Indian Ocean Territory (Chagos Archipelago), administered by the UK since 1965. A 2019 ICJ advisory opinion and a UN General Assembly resolution found its separation from Mauritius unlawful; a 2025 agreement transfers sovereignty to Mauritius while the UK retains the Diego Garcia military base under a 99-year lease.",
  },
  "Falkland Is.": {
    status: "Disputed UK/Argentina sovereignty",
    note: "A UK Overseas Territory with a self-governing population since 1841, administered continuously by the UK apart from a brief 1982 Argentine occupation that ended in war. Argentina claims sovereignty as \"Las Islas Malvinas\" and the dispute remains unresolved at the UN.",
  },
  "S. Geo. and the Is.": {
    status: "Disputed UK/Argentina sovereignty",
    note: "South Georgia and the South Sandwich Islands are a UK Overseas Territory, uninhabited apart from scientific and military personnel. Argentina includes them in its broader claim over UK territories in the South Atlantic.",
  },
};
