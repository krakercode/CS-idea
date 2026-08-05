/**
 * Ported as faithfully as possible from the original standalone HTML build
 * (CDN React 18 + in-browser Babel, no bundler) into this app's actual
 * React 19 + Vite + TypeScript setup - dropping the CDN/Babel dependency
 * entirely (loading a second React runtime and transpiling JSX at runtime
 * makes no sense inside an already-bundled, offline-capable desktop app)
 * while keeping every data table, formula, and piece of copy unchanged.
 * Data tables, pure helpers, and the season simulation all live here in one
 * file, matching how the original kept them together - splitting data from
 * the logic that closures over it (GOALS/YOUTH_EVENTS/MIDSEASON_EVENTS all
 * call helper functions inline) would fight the natural coupling for no
 * real benefit.
 */
import type {
  Choice,
  ClubTier,
  Goal,
  Headline,
  LeagueClub,
  Legacy,
  Nation,
  NationKey,
  NarrativeEvent,
  Phase,
  Player,
  Position,
  PositionKey,
  SeasonResult,
  Squad,
  StatKey,
  Stats,
  TableRow,
  Tick,
} from "./types";

/* =========================================================
   DATA
   ========================================================= */

export const POSITIONS: Record<PositionKey, Position> = {
  striker: { label: "Striker", tag: "No.9", blurb: "Lives for the six-yard box. Judged on goals, nothing else.", primary: ["pace", "shooting"], secondary: ["physical"] },
  winger: { label: "Winger", tag: "No.7/11", blurb: "Chalk on your boots. Beats a man, then beats him again.", primary: ["pace", "passing"], secondary: ["shooting"] },
  midfielder: { label: "Midfielder", tag: "No.8", blurb: "The engine room. Sees the game two passes ahead.", primary: ["passing", "mental"], secondary: ["defending"] },
  defender: { label: "Defender", tag: "No.5", blurb: "Nothing gets past. Wins the ball, starts the attack.", primary: ["defending", "physical"], secondary: ["mental"] },
};

export const STAT_LABELS: Record<StatKey, string> = { pace: "PAC", shooting: "SHO", passing: "PAS", defending: "DEF", physical: "PHY", mental: "MEN" };

export const STAT_ADVICE: Record<StatKey, { praise: string; improve: string }> = {
  pace: { praise: "you're a nightmare to track over ten yards", improve: "there's a yard of pace we still need to find" },
  shooting: { praise: "you finish like you mean it", improve: "we need more composure in the box" },
  passing: { praise: "your range of passing is a cut above", improve: "tighten up that final ball" },
  defending: { praise: "you read the game brilliantly at the back", improve: "your positioning slips when we lose the ball" },
  physical: { praise: "you win every physical battle out there", improve: "you're getting bullied out there, build some strength" },
  mental: { praise: "your head never drops, that's priceless", improve: "stay switched on for the full ninety" },
};

export const STAT_MEANING: Record<StatKey, string> = {
  pace: "Adds a little extra bite to goal and assist chances, on top of your main attacking stat.",
  shooting: "The single biggest driver of how many of your chances end up as goals.",
  passing: "Drives your assist numbers directly, and gives you more leverage in transfer & contract standoffs.",
  defending: "Drives your clean sheet count and shores up appearances when the team's under the cosh.",
  physical: "Cuts your injury risk and keeps your appearances up over a long season.",
  mental: "Drives how many minutes you get, and swings the odds on pressure moments - contracts, discipline panels, dressing-room politics.",
};

export const NATION_KEYS: NationKey[] = ["england", "scotland", "spain", "germany", "italy"];

// Fictional clubs throughout: real cities for flavour, paired with generic
// words (Forge, Vale, Reds, Crest...) that aren't any real club's actual
// name, to keep things grounded without borrowing an actual identity.
export const NATIONS: Record<NationKey, Nation> = {
  england: {
    label: "England",
    blurb: "Wet Tuesday nights, long balls, and a pyramid that never stops climbing.",
    clubs: [
      { name: "English Sunday League", strength: 28, wage: 0 },
      { name: "England Youth Academy", strength: 40, wage: 120 },
      { name: "Bristol Athletic", strength: 53, wage: 850 },
      { name: "Sheffield Athletic", strength: 66, wage: 5200 },
      { name: "Manchester Reds", strength: 79, wage: 32000 },
      { name: "London Crest", strength: 91, wage: 145000 },
    ],
    clubPool: ["Manchester Reds", "Manchester Blues", "Liverpool Rovers", "London Crest", "North London Union", "Birmingham Athletic", "Newcastle Rangers", "Leeds Wanderers", "Nottingham Town", "Brighton Rovers", "Southampton Athletic", "Derby Rovers", "Bristol Athletic", "Sheffield Athletic", "Coventry Town", "Leicester Rovers", "Portsmouth Athletic", "Reading Rangers", "Norwich Town", "Ipswich Athletic"],
  },
  scotland: {
    label: "Scotland",
    blurb: "Furious tackles, driving rain, and a fierce sense of local pride.",
    clubs: [
      { name: "Scottish Sunday League", strength: 26, wage: 0 },
      { name: "Scotland Youth Academy", strength: 38, wage: 100 },
      { name: "Ayr Athletic", strength: 50, wage: 700 },
      { name: "Dundee Thistle", strength: 62, wage: 3800 },
      { name: "Glasgow Reds", strength: 74, wage: 18000 },
      { name: "Edinburgh Crest", strength: 85, wage: 60000 },
    ],
    clubPool: ["Glasgow Reds", "Glasgow Blues", "Edinburgh Crest", "Leith Thistle", "Aberdeen Athletic", "Perth Thistle", "Paisley Rovers", "Ayr Athletic", "Inverness County", "Kilmarnock Rovers", "Falkirk Thistle", "Dundee Thistle", "Hamilton Athletic", "Airdrie Rovers", "Greenock Thistle", "Stirling Athletic", "Dumfries Rovers", "Livingston Thistle", "Motherwell Athletic", "Dunfermline County", "Clydebank Thistle"],
  },
  spain: {
    label: "Spain",
    blurb: "Technical, patient, and unforgiving if you can't handle the ball.",
    clubs: [
      { name: "Spanish Sunday League", strength: 29, wage: 0 },
      { name: "Spain Youth Academy", strength: 41, wage: 130 },
      { name: "Racing Vigo", strength: 54, wage: 900 },
      { name: "Deportivo Zaragoza", strength: 67, wage: 5600 },
      { name: "Atletico Sevilla", strength: 80, wage: 34000 },
      { name: "Sporting Madrid", strength: 92, wage: 155000 },
    ],
    clubPool: ["Sporting Madrid", "Union Madrid", "Atletico Barcelona", "Racing Sevilla", "Deportivo Valencia", "Recreativo Bilbao", "Deportivo Zaragoza", "Estrella Malaga", "Racing Vigo", "Deportivo Granada", "Atletico Alicante", "Union Cordoba", "Atletico Murcia", "Deportivo Palma", "Sporting Vitoria", "Union Gijon", "Union Santander", "Deportivo Valladolid", "Atletico Oviedo", "Racing Cadiz", "Deportivo Almeria"],
  },
  germany: {
    label: "Germany",
    blurb: "Organised, physical, and built on a proper academy system.",
    clubs: [
      { name: "German Sunday League", strength: 29, wage: 0 },
      { name: "Germany Youth Academy", strength: 41, wage: 130 },
      { name: "Concordia Bremen", strength: 55, wage: 950 },
      { name: "Phonix Stuttgart", strength: 68, wage: 5800 },
      { name: "Preussen Dortmund", strength: 81, wage: 35000 },
      { name: "Fortuna Munich", strength: 93, wage: 160000 },
    ],
    clubPool: ["Fortuna Munich", "Isar Munich", "Preussen Dortmund", "Adler Berlin", "Spree Berlin", "Kickers Hamburg", "Concordia Cologne", "Phonix Stuttgart", "Fortuna Leipzig", "Adler Frankfurt", "Concordia Bremen", "Borussia Gelsenkirchen", "Fortuna Nuremberg", "Adler Hannover", "Phonix Bochum", "Concordia Dresden", "Preussen Wolfsburg", "Fortuna Bielefeld", "Adler Mainz", "Concordia Essen", "Adler Kiel"],
  },
  italy: {
    label: "Italy",
    blurb: "Tactical, defensively sharp, and never short of theatre.",
    clubs: [
      { name: "Italian Sunday League", strength: 28, wage: 0 },
      { name: "Italy Youth Academy", strength: 40, wage: 120 },
      { name: "Pro Bologna", strength: 53, wage: 880 },
      { name: "Nuova Verona", strength: 66, wage: 5400 },
      { name: "Virtus Turin", strength: 79, wage: 33000 },
      { name: "Duomo Milan", strength: 91, wage: 150000 },
    ],
    clubPool: ["Virtus Turin", "Mole Turin", "Duomo Milan", "Pro Milan", "Virtus Rome", "Pro Naples", "Libertas Florence", "Pro Genova", "Pro Bologna", "Nuova Verona", "Virtus Bergamo", "Nuova Palermo", "Pro Cagliari", "Virtus Parma", "Nuova Udine", "Pro Lecce", "Libertas Salerno", "Nuova Venice", "Virtus Como", "Pro Trieste", "Virtus Piacenza"],
  },
};

export function currentClub(player: Player): ClubTier {
  return NATIONS[player.nation].clubs[player.clubTierIdx];
}

export function generateOpponent(nationKey: NationKey): string {
  const pool = NATIONS[nationKey] || NATIONS.england;
  return pick(pool.clubPool);
}

// Invented names only - flavoured per nation, never a real footballer's name.
const NATION_NAMES: Record<NationKey, { first: string[]; last: string[] }> = {
  england: { first: ["Jack", "Harry", "Tom", "Callum", "Ben", "George", "Charlie", "Ollie", "Ryan", "Josh"], last: ["Whitfield", "Hargreaves", "Doyle", "Sutton", "Marsh", "Kirby", "Lowe", "Fenwick", "Pryce", "Hartley"] },
  scotland: { first: ["Euan", "Callum", "Ross", "Fraser", "Craig", "Angus", "Liam", "Kyle", "Cameron", "Struan"], last: ["Buchanan", "Sinclair", "Farquhar", "Muir", "Lennox", "Kerr", "Blair", "Wylie", "Naismith", "Ogilvie"] },
  spain: { first: ["Javier", "Diego", "Pablo", "Iker", "Mateo", "Adrian", "Ruben", "Nico", "Alvaro", "Hugo"], last: ["Serrano", "Reyes", "Nunez", "Cabrera", "Ortega", "Prieto", "Vidal", "Camacho", "Ibarra", "Feijoo"] },
  germany: { first: ["Lukas", "Jonas", "Felix", "Finn", "Niklas", "Moritz", "Kai", "Leon", "Tobias", "Jannik"], last: ["Brandt", "Fischer", "Kessler", "Voss", "Hartmann", "Lindner", "Schreiber", "Wagner", "Kessel", "Berger"] },
  italy: { first: ["Marco", "Luca", "Matteo", "Davide", "Andrea", "Federico", "Simone", "Nicolo", "Riccardo", "Alessio"], last: ["Ferraro", "Bianchi", "Greco", "Marino", "Colombo", "Rinaldi", "Costa", "Fontana", "Gallo", "Moretti"] },
};
export function generatePersonName(nationKey: NationKey): string {
  const pool = NATION_NAMES[nationKey] || NATION_NAMES.england;
  return `${pick(pool.first)} ${pick(pool.last)}`;
}

const MANAGER_STYLES = [
  "Meticulous tactician, obsessed with shape",
  "Old-school motivator, all passion and hairdryers",
  "Possession purist, hates the ball going long",
  "Pragmatic to a fault - results over style",
  "Data-driven, never without a laptop on the touchline",
  "Fiery, one bad decision from a touchline ban",
  "Calm and measured, never seems to panic",
  "Man-management specialist, brilliant with the young players",
];

const SQUAD_ROLES = [
  { tag: "GK", label: "Goalkeeper" },
  { tag: "DEF", label: "Defender" },
  { tag: "DEF", label: "Defender" },
  { tag: "DEF", label: "Defender" },
  { tag: "MID", label: "Midfielder" },
  { tag: "MID", label: "Midfielder" },
  { tag: "MID", label: "Midfielder" },
  { tag: "FWD", label: "Forward" },
  { tag: "FWD", label: "Forward" },
  { tag: "FWD", label: "Forward" },
];

const PLAYER_TRAITS = [
  "Vocal leader in the dressing room", "Quiet, leads by example", "Injury-prone but brilliant on his day",
  "Cult hero with the fans", "Came up through the same academy", "Journeyman, been at six clubs already",
  "Tipped for a big move soon", "The joker of the squad", "Set-piece specialist", "Never misses a training session",
];

export function generateSquad(player: Player): Squad {
  const manager = { name: generatePersonName(player.nation), style: pick(MANAGER_STYLES) };
  const teammates = SQUAD_ROLES.map((role) => ({
    name: generatePersonName(player.nation),
    tag: role.tag,
    label: role.label,
    trait: pick(PLAYER_TRAITS),
    rating: randInt(48, 88),
  }));
  return { manager, teammates };
}

export const GOALS: Goal[] = [
  { id: "scorer", label: "All-Time Top Scorer", desc: "Retire with 200+ career goals.", target: 200, unit: "goals", metric: (p) => p.careerTotals.goals },
  { id: "playmaker", label: "The Complete Playmaker", desc: "Retire with 150+ career assists.", target: 150, unit: "assists", metric: (p) => p.careerTotals.assists },
  { id: "wall", label: "The Immovable Wall", desc: "Retire with 120+ clean sheets.", target: 120, unit: "clean sheets", metric: (p) => p.careerTotals.cleanSheets },
  { id: "invincible", label: "The Invincible Season", desc: "Go through one full season without losing a single match.", target: 1, unit: "unbeaten season", metric: (p) => (p.hasInvincibleSeason ? 1 : 0) },
  { id: "wonderkid", label: "Wonderkid Winner", desc: "Lift your first piece of silverware before turning 21.", target: 1, unit: "early trophy", metric: (p) => (p.firstTrophyAge !== null && p.firstTrophyAge < 21 ? 1 : 0) },
  { id: "summit", label: "Reach the Summit", desc: "Earn a move all the way to an elite top-flight club.", target: 1, unit: "top tier reached", metric: (p) => (p.clubTierIdx >= 5 ? 1 : 0) },
  { id: "caps", label: "Country Before Club", desc: "Retire with 50+ international caps.", target: 50, unit: "caps", metric: (p) => p.caps },
];

/* =========================================================
   HELPERS
   ========================================================= */

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
export function firstName(p: Player): string {
  return p.name.split(" ")[0];
}
export function ordinalSuffix(n: number): string {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function statTier(v: number): string {
  if (v >= 85) return "WORLD CLASS";
  if (v >= 72) return "VERY GOOD";
  if (v >= 58) return "SOLID";
  if (v >= 42) return "DEVELOPING";
  return "LIMITED";
}

export function computeOverall(stats: Stats, positionKey: PositionKey): number {
  const pos = POSITIONS[positionKey];
  const primaryAvg = pos.primary.reduce((s, k) => s + stats[k], 0) / pos.primary.length;
  const secondaryAvg = pos.secondary.reduce((s, k) => s + stats[k], 0) / pos.secondary.length;
  const allAvg = Object.values(stats).reduce((s, v) => s + v, 0) / Object.values(stats).length;
  return Math.round(clamp(primaryAvg * 0.55 + secondaryAvg * 0.25 + allAvg * 0.2, 1, 99));
}

/* =========================================================
   YOUTH ACADEMY -> PRO TRIAL PATHWAY
   ========================================================= */

// Index 1 in every NATIONS[..].clubs array is that nation's own Youth
// Academy (e.g. "Italy Youth Academy" for an Italian-born player) - the
// same index across all five nations, so one constant covers all of them.
export const ACADEMY_TIER_IDX = 1;
export const PRO_TRIAL_START_AGE = 18;
export const PRO_TRIAL_CUTOFF_AGE = 21;

/** Odds of a pro contract offer landing at a given trial - scales with
 * ability and reputation, same shape as the other chance formulas above
 * (transfer-interest, contract-renewal, etc). */
export function proOfferChance(player: Player): number {
  const overall = computeOverall(player.stats, player.position);
  return clamp(0.12 + (overall - 45) / 90 + player.reputation / 260, 0.05, 0.85);
}

// A raw academy graduate doesn't walk straight into an elite club - lands
// at one of the two lowest pro tiers, with the higher of the two reserved
// for a genuinely strong trial (tiers above that are earned later via the
// normal mid-career transfer-interest/overseas-approach events).
export function proOfferTier(player: Player): number {
  const overall = computeOverall(player.stats, player.position);
  return overall >= 62 ? ACADEMY_TIER_IDX + 2 : ACADEMY_TIER_IDX + 1;
}

export function newPlayer(name: string, positionKey: PositionKey, goal: Goal, nationKey: NationKey): Player {
  const pos = POSITIONS[positionKey];
  const stats: Stats = { pace: 0, shooting: 0, passing: 0, defending: 0, physical: 0, mental: 0 };
  (Object.keys(stats) as StatKey[]).forEach((k) => {
    let base = randInt(32, 42);
    if (pos.primary.includes(k)) base += randInt(12, 18);
    if (pos.secondary.includes(k)) base += randInt(5, 10);
    stats[k] = clamp(base, 1, 90);
  });
  return {
    name: name || "Alex Rowntree",
    position: positionKey,
    goal,
    nation: nationKey,
    age: 16,
    stats,
    reputation: 20,
    wage: 0,
    clubTierIdx: 0,
    trophies: [],
    careerTotals: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, peakOverall: 0 },
    seasonsPlayed: 0,
    seasonHistory: [],
    hasInvincibleSeason: false,
    firstTrophyAge: null,
    caps: 0,
    capGoals: 0,
    debutCapAge: null,
    squad: null,
  };
}

export function bumpStats(player: Player, deltas: Partial<Stats>): Player {
  const stats = { ...player.stats };
  (Object.entries(deltas) as [StatKey, number | undefined][]).forEach(([k, v]) => {
    if (!k || v === undefined) return;
    stats[k] = clamp(stats[k] + v, 1, 99);
  });
  return { ...player, stats };
}

/* =========================================================
   NARRATIVE CONTENT
   ========================================================= */

export const YOUTH_EVENTS: NarrativeEvent[] = [
  {
    id: "tuesday-night-training",
    title: "Tuesday night training",
    text: (p) => `Your Sunday league coach pulls ${firstName(p)} aside after another 6am session. "You've got something. Question is what you do with it."`,
    choices: [
      { label: "Grind the technical drills", detail: "+Shooting +Passing", apply: (p) => bumpStats(p, { shooting: 6, passing: 6 }) },
      { label: "Chase every fitness session", detail: "+Pace +Physical", apply: (p) => bumpStats(p, { pace: 6, physical: 6 }) },
      { label: "Balance football with schoolwork", detail: "+Mental, small boost everywhere", apply: (p) => bumpStats(p, { mental: 8, pace: 2, shooting: 2, passing: 2, defending: 2, physical: 2 }) },
    ],
  },
  {
    id: "scout-day",
    title: "Scout day",
    text: (p) => `A scout from ${NATIONS[p.nation].clubs[1].name} is watching from the touchline with a clipboard. This is the trial that decides everything.`,
    choices: [
      { label: "Play it safe, do the simple things well", detail: "+Reputation, steady", apply: (p) => ({ ...p, reputation: p.reputation + 15 }) },
      {
        label: "Go for the moment of magic",
        detail: "High risk: odds improve with your raw ability",
        apply: (p) => {
          const pos = POSITIONS[p.position];
          const avgPrimary = pos.primary.reduce((s, k) => s + p.stats[k], 0) / pos.primary.length;
          const hitChance = clamp(0.3 + (avgPrimary - 40) / 110, 0.15, 0.8);
          const hit = Math.random() < hitChance;
          return { ...p, reputation: p.reputation + (hit ? 32 : -10) };
        },
      },
    ],
  },
];

export const MIDSEASON_EVENTS: NarrativeEvent[] = [
  {
    id: "injury-scare",
    title: "Injury scare",
    text: (p) => `${firstName(p)} pulls up sharp in training. The physio's face says it all.`,
    choices: [
      { label: "Rest it properly", detail: "Protects long-term stats", apply: (p) => bumpStats(p, { physical: 3, mental: 2 }) },
      {
        label: "Play through it",
        detail: "+Reputation now - risk shrinks the higher your Physical is",
        apply: (p) => {
          const disasterChance = clamp(0.42 - p.stats.physical / 220, 0.08, 0.42);
          const disaster = Math.random() < disasterChance;
          return bumpStats({ ...p, reputation: p.reputation + (disaster ? -20 : 12) }, { physical: disaster ? -10 : 0 });
        },
      },
    ],
  },
  {
    id: "transfer-interest",
    title: "Transfer interest",
    text: (p, club) => `Word reaches the dressing room: a bigger club has been watching ${firstName(p)} for weeks. ${club.name} won't want to let you go easily.`,
    choices: [
      {
        label: "Push for the move",
        detail: "Odds of jumping a tier scale with reputation & ability",
        apply: (p) => {
          const overall = computeOverall(p.stats, p.position);
          const moveChance = clamp(0.18 + p.reputation / 160 + (overall - 50) / 160, 0.08, 0.85);
          const moves = Math.random() < moveChance && p.clubTierIdx < NATIONS[p.nation].clubs.length - 1;
          const updated = { ...p, clubTierIdx: moves ? p.clubTierIdx + 1 : p.clubTierIdx, reputation: p.reputation + (moves ? 10 : -5) };
          return moves ? { ...updated, squad: generateSquad(updated) } : updated;
        },
      },
      { label: "Stay loyal to the badge", detail: "+Fan reputation, captaincy chances", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 8 }, { mental: 4 }) },
    ],
  },
  {
    id: "overseas-approach",
    title: "Overseas approach",
    text: (p, club) => `Scouts have flown in from abroad. There's real interest in taking ${firstName(p)} away from ${club.name} for a fresh start in a different country.`,
    choices: [
      {
        label: "Make the move abroad",
        detail: "New country, new league - landing spot depends on reputation & ability",
        apply: (p) => {
          const overall = computeOverall(p.stats, p.position);
          const targets = NATION_KEYS.filter((k) => k !== p.nation);
          const target = pick(targets);
          let delta = 0;
          if (p.reputation >= 70 && overall >= 65) delta = 1;
          else if (p.reputation < 35) delta = -1;
          const landing = clamp(p.clubTierIdx + delta, 0, NATIONS[target].clubs.length - 1);
          const newWage = Math.round(NATIONS[target].clubs[landing].wage * (1 + p.reputation / 250));
          const updated = { ...p, nation: target, clubTierIdx: landing, wage: newWage, reputation: p.reputation + 6 };
          return { ...updated, squad: generateSquad(updated) };
        },
      },
      { label: "Stay and fight for your place here", detail: "+Mental, no move", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "media-storm",
    title: "Media storm",
    text: (p) => `A post-match interview clip of ${firstName(p)} is everywhere online. The phone won't stop buzzing.`,
    choices: [
      { label: "Keep your head down", detail: "+Mental, low profile", apply: (p) => bumpStats(p, { mental: 6 }) },
      { label: "Lean into the spotlight", detail: "+Reputation +Wage, risks focus", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 14, wage: Math.round(p.wage * 1.15) }, { mental: -4 }) },
    ],
  },
  {
    id: "international-call-up",
    title: "International call-up",
    text: (p) => `A letter arrives from the national federation. They want ${firstName(p)} in the squad for the upcoming fixtures.`,
    choices: [
      {
        label: "Accept the call",
        detail: "Earns caps - goals & reputation depend on how you play",
        apply: (p) => {
          const overall = computeOverall(p.stats, p.position);
          const pos = POSITIONS[p.position];
          const fixtures = randInt(1, 2);
          let capGoalsThisBreak = 0;
          for (let i = 0; i < fixtures; i++) {
            if (pos.primary.includes("shooting") || pos.primary.includes("passing")) {
              const scoreChance = clamp(0.15 + (overall - 55) / 160, 0.05, 0.55);
              if (Math.random() < scoreChance) capGoalsThisBreak++;
            }
          }
          const wentWell = Math.random() < clamp(0.35 + (overall - 50) / 140, 0.15, 0.85);
          const debutAge = p.debutCapAge === null ? p.age : p.debutCapAge;
          return bumpStats(
            { ...p, caps: p.caps + fixtures, capGoals: p.capGoals + capGoalsThisBreak, debutCapAge: debutAge, reputation: p.reputation + (wentWell ? 14 : 2) + capGoalsThisBreak * 4 },
            { physical: -3, mental: wentWell ? 4 : 1 },
          );
        },
      },
      { label: "Decline, focus on the club", detail: "Steady, no caps earned", apply: (p) => p },
    ],
  },
  {
    id: "new-manager-new-system",
    title: "New manager, new system",
    text: () => `A new manager walks in wanting to rebuild everything from set pieces to shape. Nobody's place is guaranteed.`,
    choices: [
      { label: "Adapt without complaint", detail: "+Mental", apply: (p) => bumpStats(p, { mental: 6 }) },
      {
        label: "Demand your usual role",
        detail: "Backing you get scales with ability & reputation",
        apply: (p) => {
          const key = POSITIONS[p.position].primary[0];
          const overall = computeOverall(p.stats, p.position);
          const backedChance = clamp(0.25 + (overall - 50) / 150 + p.reputation / 250, 0.1, 0.85);
          const backed = Math.random() < backedChance;
          return bumpStats(p, { [key]: backed ? 8 : -6, mental: backed ? 2 : -2 });
        },
      },
    ],
  },
  {
    id: "boot-deal-on-the-table",
    title: "Boot deal on the table",
    text: () => `A sportswear rep slides a contract across the table. Decent money, a bit of extra scrutiny.`,
    choices: [
      { label: "Sign it", detail: "+Wage +Reputation", apply: (p) => ({ ...p, wage: Math.round(p.wage * 1.2) + 200, reputation: p.reputation + 6 }) },
      { label: "Turn it down, stay focused", detail: "+Mental", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "dressing-room-bust-up",
    title: "Dressing room bust-up",
    text: () => `Two senior players are toe-to-toe after training. Everyone's watching to see who steps in.`,
    choices: [
      { label: "Back your strongest ally", detail: "+Mental +Reputation, picks a side", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 5 }, { mental: 4 }) },
      { label: "Stay well out of it", detail: "+Mental, no reputation change", apply: (p) => bumpStats(p, { mental: 3 }) },
    ],
  },
  {
    id: "contract-renewal",
    title: "Contract renewal",
    text: (p, club) => `${club.name} want to tie ${firstName(p)} down to a new deal before the vultures start circling.`,
    choices: [
      { label: "Sign a long-term deal", detail: "Wage security, small +Reputation", apply: (p) => ({ ...p, wage: Math.round(p.wage * 1.15), reputation: p.reputation + 4 }) },
      {
        label: "Hold out for more money",
        detail: "Odds improve with reputation & ability - that's your leverage",
        apply: (p) => {
          const overall = computeOverall(p.stats, p.position);
          const winChance = clamp(0.2 + p.reputation / 160 + (overall - 50) / 180, 0.1, 0.85);
          const win = Math.random() < winChance;
          return { ...p, wage: Math.round(p.wage * (win ? 1.45 : 1.05)), reputation: p.reputation + (win ? 4 : -10) };
        },
      },
    ],
  },
  {
    id: "the-super-agent-comes-calling",
    title: "The super-agent comes calling",
    text: (p) => `A flashy super-agent takes ${firstName(p)} for dinner and promises the world.`,
    choices: [
      { label: "Sign with them", detail: "+Wage via sponsorships, risks focus", apply: (p) => bumpStats({ ...p, wage: Math.round(p.wage * 1.25) }, { mental: -3 }) },
      { label: "Stick with your current agent", detail: "+Mental, steady", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "board-under-pressure",
    title: "Board under pressure",
    text: (_p, club) => `Results have been shaky and ${club.name}'s board are making noise in the papers.`,
    choices: [
      { label: "Rally the dressing room", detail: "+Mental, small +Reputation", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 4 }, { mental: 5 }) },
      { label: "Focus only on your own game", detail: "Protects your stats, no reputation change", apply: (p) => p },
    ],
  },
  {
    id: "loss-of-form",
    title: "Loss of form",
    text: (p) => `The performances have dipped and pundits have started to notice. ${firstName(p)} needs an answer.`,
    choices: [
      {
        label: "Put in extra hours alone",
        detail: "+Primary stat, small physical cost",
        apply: (p) => {
          const key = POSITIONS[p.position].primary[0];
          return bumpStats(p, { [key]: 7, physical: -2 });
        },
      },
      { label: "Trust the coaching staff", detail: "+Mental, steadier recovery", apply: (p) => bumpStats(p, { mental: 5 }) },
    ],
  },
  {
    id: "breakout-performance",
    title: "Breakout performance",
    text: (p) => `A man-of-the-match display has pundits calling ${firstName(p)} the real deal.`,
    choices: [
      { label: "Let it fuel you", detail: "+Reputation, small +primary stat", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 10 }, { [POSITIONS[p.position].primary[0]]: 3 }) },
      { label: "Stay grounded", detail: "+Mental", apply: (p) => bumpStats(p, { mental: 5 }) },
    ],
  },
  {
    id: "captaincy-offer",
    title: "Captaincy offer",
    text: (p) => `The manager pulls ${firstName(p)} aside: "How do you fancy wearing the armband?"`,
    choices: [
      { label: "Accept the armband", detail: "+Mental +Reputation, extra pressure", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 10 }, { mental: 4 }) },
      { label: "Pass it to a senior teammate", detail: "+Mental, no reputation change", apply: (p) => bumpStats(p, { mental: 3 }) },
    ],
  },
  {
    id: "discipline-hearing",
    title: "Discipline hearing",
    text: (p) => `A reckless tackle earns ${firstName(p)} a straight red in a huge game. The panel wants a word.`,
    choices: [
      { label: "Hold your hands up", detail: "+Mental, small reputation hit", apply: (p) => bumpStats({ ...p, reputation: p.reputation - 5 }, { mental: 4 }) },
      {
        label: "Blame the referee publicly",
        detail: "How reputable you are decides whether the press back you",
        apply: (p) => {
          const backedChance = clamp(0.2 + p.reputation / 180, 0.1, 0.7);
          const backed = Math.random() < backedChance;
          return { ...p, reputation: p.reputation + (backed ? 12 : -14) };
        },
      },
    ],
  },
  {
    id: "testimonial-year",
    title: "Testimonial year",
    text: (p, club) => `${club.name} want to arrange a testimonial match to honour ${firstName(p)}'s service to the shirt.`,
    choices: [
      { label: "Accept the send-off", detail: "+Wage +Reputation", apply: (p) => ({ ...p, wage: Math.round(p.wage * 1.1) + 500, reputation: p.reputation + 8 }) },
      { label: "Decline quietly, keep the focus on football", detail: "+Mental", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "a-promising-kid-shadows-you",
    title: "A promising kid shadows you",
    text: (p) => `An academy prospect has been assigned to train alongside ${firstName(p)} every session.`,
    choices: [
      { label: "Mentor him properly", detail: "+Mental, small +Reputation", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 4 }, { mental: 4 }) },
      { label: "Focus purely on your own game", detail: "Protects your stats", apply: (p) => p },
    ],
  },
  {
    id: "derby-week",
    title: "Derby week",
    text: (_p, club) => `The whole city is talking about nothing else. ${club.name}'s biggest rivals are in town, and the fans expect a result.`,
    choices: [
      {
        label: "Thrive on the occasion",
        detail: "Big swing either way, odds improve with Mental",
        apply: (p) => {
          const key = POSITIONS[p.position].primary[0];
          const bigMoment = Math.random() < clamp(0.3 + p.stats.mental / 200, 0.15, 0.75);
          return bumpStats({ ...p, reputation: p.reputation + (bigMoment ? 12 : -6) }, { [key]: bigMoment ? 5 : -3 });
        },
      },
      { label: "Treat it like any other game", detail: "+Mental, no swing", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "a-rival-for-your-shirt",
    title: "A rival for your shirt",
    text: (_p, club) => `${club.name} have splashed the cash on a new signing in your exact position. The manager says the shirt is up for grabs.`,
    choices: [
      {
        label: "Fight for your place in training",
        detail: "Odds of winning it out scale with overall ability",
        apply: (p) => {
          const overall = computeOverall(p.stats, p.position);
          const key = POSITIONS[p.position].primary[0];
          const won = Math.random() < clamp(0.3 + (overall - 50) / 150, 0.15, 0.8);
          return bumpStats({ ...p, reputation: p.reputation + (won ? 8 : -6) }, { [key]: won ? 4 : 0, mental: won ? 2 : -2 });
        },
      },
      { label: "Accept a squad rotation role for now", detail: "+Mental, steady", apply: (p) => bumpStats(p, { mental: 5 }) },
    ],
  },
  {
    id: "player-of-the-month",
    title: "Player of the Month",
    text: (p) => `${firstName(p)}'s recent form has the pundits talking, and the league's put your name up for Player of the Month.`,
    choices: [
      { label: "Do the media rounds", detail: "+Reputation +Wage, small Mental cost", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 10, wage: Math.round(p.wage * 1.08) }, { mental: -2 }) },
      { label: "Let the football speak for itself", detail: "+Mental", apply: (p) => bumpStats(p, { mental: 5 }) },
    ],
  },
  {
    id: "sports-science-overhaul",
    title: "Sports science overhaul",
    text: (_p, club) => `${club.name} bring in a new fitness department wanting to rebuild everyone's training load from scratch.`,
    choices: [
      { label: "Buy into the new regime", detail: "+Physical, short adjustment period", apply: (p) => bumpStats(p, { physical: 6, mental: -1 }) },
      { label: "Stick to what's always worked for you", detail: "+Mental, no Physical change", apply: (p) => bumpStats(p, { mental: 3 }) },
    ],
  },
  {
    id: "release-clause-rumours",
    title: "Release clause rumours",
    text: (p) => `A number starts doing the rounds in the papers - supposedly ${firstName(p)}'s release clause. Nobody at the club will confirm it.`,
    choices: [
      {
        label: "Use it as leverage for a new deal",
        detail: "Odds scale with reputation - looks bad if you overreach",
        apply: (p) => {
          const win = Math.random() < clamp(0.25 + p.reputation / 160, 0.1, 0.8);
          return { ...p, wage: Math.round(p.wage * (win ? 1.3 : 1.02)), reputation: p.reputation + (win ? 6 : -8) };
        },
      },
      { label: "Let your agent handle it quietly", detail: "+Mental, no drama", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "pundit-criticism",
    title: "Pundit criticism",
    text: (p) => `A well-known ex-pro goes after ${firstName(p)} on TV, questioning whether you're really good enough for this level.`,
    choices: [
      {
        label: "Fire back on social media",
        detail: "Reputation swing scales with how popular you already are",
        apply: (p) => {
          const backed = Math.random() < clamp(0.2 + p.reputation / 170, 0.1, 0.7);
          return { ...p, reputation: p.reputation + (backed ? 10 : -12) };
        },
      },
      { label: "Let your performances answer for you", detail: "+Mental, steady", apply: (p) => bumpStats(p, { mental: 6 }) },
    ],
  },
  {
    id: "an-old-teammate-lines-up-against-you",
    title: "An old teammate lines up against you",
    text: (p) => `Someone ${firstName(p)} came through the academy with is starting for the opposition this weekend. First time facing off since those early days.`,
    choices: [
      {
        label: "Make a point out on the pitch",
        detail: "Small Reputation swing",
        apply: (p) => {
          const wins = Math.random() < 0.5;
          return { ...p, reputation: p.reputation + (wins ? 6 : -3) };
        },
      },
      { label: "Enjoy the reunion, keep it friendly", detail: "+Mental", apply: (p) => bumpStats(p, { mental: 4 }) },
    ],
  },
  {
    id: "community-day",
    title: "Community day",
    text: (p, club) => `${club.name} ask ${firstName(p)} to spend a day visiting a local school and the children's hospital ward.`,
    choices: [
      { label: "Give it the whole day, no cameras needed", detail: "+Reputation +Mental", apply: (p) => bumpStats({ ...p, reputation: p.reputation + 6 }, { mental: 5 }) },
      { label: "Make a brief, well-publicised appearance", detail: "+Reputation only", apply: (p) => ({ ...p, reputation: p.reputation + 4 }) },
    ],
  },
  {
    id: "cup-giant-killing-on-the-cards",
    title: "Cup giant-killing on the cards",
    text: (_p, club) => `The cup draw hasn't been kind - a top-flight side away from home, and every neutral fancying the upset for ${club.name}.`,
    choices: [
      {
        label: "Go toe-to-toe with them",
        detail: "+Reputation, risk of a card scaling down with Mental",
        apply: (p) => {
          const cardRisk = clamp(0.3 - p.stats.mental / 300, 0.08, 0.3);
          const carded = Math.random() < cardRisk;
          return { ...p, reputation: p.reputation + (carded ? -6 : 12) };
        },
      },
      { label: "Stay disciplined and take your chances", detail: "+Mental, steadier", apply: (p) => bumpStats(p, { mental: 5 }) },
    ],
  },
  {
    id: "boot-deal-clash",
    title: "Boot deal clash",
    text: (p, club) => `Your personal boot sponsor wants ${firstName(p)} in their new silo, but it clashes with ${club.name}'s official kit supplier deal.`,
    choices: [
      {
        label: "Wear them anyway, quietly",
        detail: "+Wage, small Reputation risk if noticed",
        apply: (p) => {
          const noticed = Math.random() < 0.3;
          return { ...p, wage: Math.round(p.wage * 1.15) + 150, reputation: p.reputation + (noticed ? -5 : 0) };
        },
      },
      { label: "Respect the club's kit deal", detail: "+Mental, no Wage change", apply: (p) => bumpStats(p, { mental: 3 }) },
    ],
  },
];

// Keyed by each event's stable `id` (not its `title`) so editing an event's
// display copy later can never silently disable or change its gating -
// a typo in a title string used to fail closed with no warning.
const EVENT_ELIGIBILITY: Partial<Record<string, (player: Player) => boolean>> = {
  "testimonial-year": (p) => p.age >= 33,
  "breakout-performance": (p) => p.age <= 22,
  "captaincy-offer": (p) => p.reputation >= 45,
  "a-promising-kid-shadows-you": (p) => p.age >= 27,
  "loss-of-form": (p) => p.seasonsPlayed >= 1,
  "a-rival-for-your-shirt": (p) => p.age >= 20,
  "player-of-the-month": (p) => p.reputation >= 30,
  "release-clause-rumours": (p) => p.reputation >= 40,
  "an-old-teammate-lines-up-against-you": (p) => p.seasonsPlayed >= 2,
  "cup-giant-killing-on-the-cards": (p) => p.clubTierIdx <= 3,
  "international-call-up": (p) => p.reputation >= 25,
  // Both of these can jump a player a whole tier (or country) - reserved
  // for pro careers so the pro-trial pathway stays the only way out of the
  // academy, rather than one of these quietly doing it instead.
  "transfer-interest": (p) => p.clubTierIdx > ACADEMY_TIER_IDX,
  "overseas-approach": (p) => p.clubTierIdx > ACADEMY_TIER_IDX,
};

export function eligibleEvents(player: Player): NarrativeEvent[] {
  const pool = MIDSEASON_EVENTS.filter((e) => (EVENT_ELIGIBILITY[e.id] ?? (() => true))(player));
  return pool.length ? pool : MIDSEASON_EVENTS;
}

export const PRESEASON_CHOICES: Choice[] = [
  { label: "Technical work", detail: "+Shooting +Passing", apply: (p) => bumpStats(p, { shooting: 4, passing: 4 }) },
  { label: "Fitness block", detail: "+Pace +Physical", apply: (p) => bumpStats(p, { pace: 4, physical: 4 }) },
  { label: "Tactical study", detail: "+Mental +Defending", apply: (p) => bumpStats(p, { mental: 4, defending: 4 }) },
  { label: "Rest and recover", detail: "Small boost everywhere, lowers injury risk", apply: (p) => bumpStats(p, { pace: 1, shooting: 1, passing: 1, defending: 1, physical: 2, mental: 2 }) },
];

const COACH_OPENERS: Record<"pleased" | "level" | "concerned", string[]> = {
  pleased: ["I'll be honest, I'm pleased with that.", "That's the level we want to see all year.", "Can't ask for much more this season."],
  level: ["It's been alright. Nothing more, nothing less.", "There's a season in there somewhere.", "We'll take it, but there's more in the tank."],
  concerned: ["That's not good enough, and you know it.", "We need to have a serious conversation about consistency.", "I've seen better from you, and so have you."],
};

// Knuth's algorithm - real Poisson sampling, so a striker's expected-goals
// rate per match translates into a believable, streaky season tally.
export function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export function describeMatch(player: Player, t: Tick): string {
  const n = firstName(player);
  if (!t.appeared) return `${n} didn't make the matchday squad.`;
  const bits: string[] = [];
  if (t.goals >= 2) bits.push("bagged a brace");
  else if (t.goals === 1) bits.push("got on the scoresheet");
  if (t.assists >= 2) bits.push("teed up two more");
  else if (t.assists === 1) bits.push("supplied the assist");
  if (t.cleanSheet) bits.push("marshalled a clean sheet at the back");
  if (bits.length === 0) {
    if (t.result === "L") bits.push("had a quiet afternoon as things fell apart");
    else if (t.result === "W") bits.push("played a steady, unspectacular part in the win");
    else bits.push("ground out a share of the points");
  }
  return `${n} ${bits.join(" and ")} - rated ${t.rating.toFixed(1)}.`;
}

export function generatePerformanceNote(player: Player, result: SeasonResult): string {
  const pos = POSITIONS[player.position];
  const overall = computeOverall(player.stats, player.position);
  let line: string;
  if (pos.primary.includes("shooting")) {
    line = `SHO ${player.stats.shooting} (${statTier(player.stats.shooting)}) converted into ${result.goals} goals from ${result.appearances} appearances.`;
  } else if (pos.primary.includes("passing")) {
    line = `PAS ${player.stats.passing} (${statTier(player.stats.passing)}) drove ${result.assists} assists from ${result.appearances} appearances.`;
  } else {
    line = `DEF ${player.stats.defending} (${statTier(player.stats.defending)}) kept ${result.cleanSheets} clean sheets from ${result.appearances} appearances.`;
  }
  return `${line} An overall of ${overall} pulled the side to a ${result.tableSpot.toLowerCase()} finish.`;
}

export type CoachFeedbackInput = Pick<SeasonResult, "tableSpot" | "goals" | "assists" | "cleanSheets" | "appearances">;

export function generateCoachFeedback(player: Player, result: CoachFeedbackInput): { mood: "pleased" | "level" | "concerned"; quote: string } {
  const mood = result.tableSpot === "Champions" || result.tableSpot === "Continental spot" ? "pleased" : result.tableSpot === "Relegated" ? "concerned" : "level";
  const entries = Object.entries(player.stats) as [StatKey, number][];
  const strongest = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const weakest = entries.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  const opener = pick(COACH_OPENERS[mood]);
  const output = result.goals + result.assists * 0.8 + result.cleanSheets * 0.7;
  const outputLine = output >= 18 ? ` And ${result.appearances} appearances with numbers like that speak for themselves.` : "";
  return { mood, quote: `${opener} ${STAT_ADVICE[strongest].praise.charAt(0).toUpperCase() + STAT_ADVICE[strongest].praise.slice(1)}. But ${STAT_ADVICE[weakest].improve}.${outputLine}` };
}

/* =========================================================
   LEAGUE - a real 20-club table, not just your own results
   ========================================================= */

const LEAGUE_SIZE = 20;

function buildLeagueClubs(player: Player): LeagueClub[] {
  const club = currentClub(player);
  const used = new Set([club.name]);
  const clubs: LeagueClub[] = [{ name: club.name, strength: club.strength }];
  let guard = 0;
  while (clubs.length < LEAGUE_SIZE && guard < 500) {
    guard++;
    const name = generateOpponent(player.nation);
    if (used.has(name)) continue;
    used.add(name);
    clubs.push({ name, strength: clamp(club.strength + randInt(-14, 14), 5, 99) });
  }
  return clubs;
}

// Standard circle method: team index 0 (the player's club) is pinned in
// place, everyone else rotates around it. Doubled up for a 38-game season.
function buildSchedule(n: number): [number, number][][] {
  const idx = Array.from({ length: n }, (_, i) => i);
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) round.push([idx[i], idx[n - 1 - i]]);
    rounds.push(round);
    idx.splice(1, 0, idx.pop() as number);
  }
  return [...rounds, ...rounds.map((round) => round.map(([a, b]) => [b, a] as [number, number]))];
}

function simulateFixture(strengthA: number, strengthB: number): { outcome: "A" | "D" | "B"; goalsA: number; goalsB: number } {
  const winP = clamp(0.33 + (strengthA - strengthB) / 100, 0.05, 0.85);
  const roll = Math.random();
  const outcome: "A" | "D" | "B" = roll < winP ? "A" : roll < winP + 0.26 ? "D" : "B";
  let goalsA: number, goalsB: number;
  if (outcome === "D") { goalsA = goalsB = randInt(0, 2); }
  else {
    const winnerGoals = randInt(1, 3);
    const loserGoals = randInt(0, Math.max(0, winnerGoals - 1));
    if (outcome === "A") { goalsA = winnerGoals; goalsB = loserGoals; } else { goalsB = winnerGoals; goalsA = loserGoals; }
  }
  return { outcome, goalsA, goalsB };
}

function sortTable(a: TableRow, b: TableRow): number {
  if (b.pts !== a.pts) return b.pts - a.pts;
  const gdB = b.gf - b.ga, gdA = a.gf - a.ga;
  if (gdB !== gdA) return gdB - gdA;
  return b.gf - a.gf;
}

/* =========================================================
   SEASON SIMULATION - every attribute does something here
   ========================================================= */

export function simulateSeason(player: Player): SeasonResult {
  const club = currentClub(player);
  const stats = player.stats;
  const overall = computeOverall(stats, player.position);
  const pos = POSITIONS[player.position];

  // How much does one player's quality move a team? Huge in Sunday league,
  // marginal at the very top where you're one of eleven elite pros.
  const tierWeight = clamp(0.34 - player.clubTierIdx * 0.04, 0.12, 0.34);
  const teamStrength = club.strength * (1 - tierWeight) + overall * tierWeight;

  const clubs = buildLeagueClubs(player);
  clubs[0].strength = teamStrength;
  const table: TableRow[] = clubs.map((c, i) => ({ name: c.name, isPlayerClub: i === 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }));
  const rounds = buildSchedule(LEAGUE_SIZE);

  let points = 0, wins = 0, draws = 0, losses = 0;
  let appearances = 0, goals = 0, assists = 0, cleanSheets = 0;
  let ratingSum = 0, ratedMatches = 0;
  const ticks: Tick[] = [];
  const sampleWeeks = [3, 9, 15, 22, 28, 34, 38];
  const tableSnapshots: Record<number, TableRow[]> = {};

  for (let md = 1; md <= 38; md++) {
    let playerResult: "W" | "D" | "L" | null = null, playerOpp = "";

    rounds[md - 1].forEach(([i, j]) => {
      const { outcome, goalsA, goalsB } = simulateFixture(clubs[i].strength, clubs[j].strength);
      const home = table[i], away = table[j];
      home.played++; away.played++;
      home.gf += goalsA; home.ga += goalsB;
      away.gf += goalsB; away.ga += goalsA;
      if (outcome === "D") { home.drawn++; away.drawn++; home.pts += 1; away.pts += 1; }
      else if (outcome === "A") { home.won++; home.pts += 3; away.lost++; }
      else { away.won++; away.pts += 3; home.lost++; }

      if (i === 0) { playerResult = outcome === "A" ? "W" : outcome === "D" ? "D" : "L"; playerOpp = clubs[j].name; }
      else if (j === 0) { playerResult = outcome === "B" ? "W" : outcome === "D" ? "D" : "L"; playerOpp = clubs[i].name; }
    });

    const result = playerResult;
    if (result === "W") { wins++; points += 3; } else if (result === "D") { draws++; points += 1; } else { losses++; }

    // Fitness (physical) and reputation decide whether you're even out there.
    const startProb = clamp(0.5 + (overall - 55) / 140 + (player.reputation - 50) / 220 + (stats.physical - 50) / 260, 0.12, 0.97);
    let appeared = Math.random() < startProb;
    let minutesFactor = 1;
    if (!appeared && Math.random() < 0.22) { appeared = true; minutesFactor = 0.4; }

    let matchGoals = 0, matchAssists = 0, matchCleanSheet = false, rating: number | null = null;
    if (appeared) {
      appearances++;
      const serviceMultiplier = 0.75 + teamStrength / 160;

      if (pos.primary.includes("shooting")) {
        const eg = (Math.pow(stats.shooting / 99, 1.2) * 0.5 + (stats.pace / 99) * 0.12) * serviceMultiplier * minutesFactor;
        matchGoals = samplePoisson(eg);
        goals += matchGoals;
      }
      if (pos.primary.includes("passing")) {
        const ea = (Math.pow(stats.passing / 99, 1.15) * 0.38 + (stats.pace / 99) * 0.1) * serviceMultiplier * minutesFactor;
        matchAssists = samplePoisson(ea);
        assists += matchAssists;
      }
      if (pos.primary.includes("defending")) {
        const csChance = clamp(0.22 + (stats.defending - 50) / 220 + (stats.mental - 50) / 300 + (result === "W" ? 0.15 : result === "D" ? 0.05 : -0.12), 0.05, 0.85) * minutesFactor;
        if (Math.random() < csChance) { matchCleanSheet = true; cleanSheets++; }
      }

      rating = clamp(
        5.6 + (overall - 50) / 26 + matchGoals * 0.5 + matchAssists * 0.35 + (matchCleanSheet ? 0.3 : 0) +
          (result === "W" ? 0.25 : result === "L" ? -0.25 : 0) + (stats.mental - 50) / 240 + (Math.random() * 0.5 - 0.25),
        4, 9.8,
      );
      ratingSum += rating;
      ratedMatches++;
    }

    if (sampleWeeks.includes(md)) {
      ticks.push({ md, opp: playerOpp, result, appeared, goals: matchGoals, assists: matchAssists, cleanSheet: matchCleanSheet, rating: rating || 0 });
      tableSnapshots[md] = table.map((c) => ({ ...c })).sort(sortTable);
    }
  }

  const finalTable = table.map((c) => ({ ...c })).sort(sortTable);
  const leaguePosition = finalTable.findIndex((c) => c.isPlayerClub) + 1;

  let tableSpot: string;
  if (leaguePosition === 1) tableSpot = "Champions";
  else if (leaguePosition <= 6) tableSpot = "Continental spot";
  else if (leaguePosition <= 14) tableSpot = "Mid-table";
  else if (leaguePosition <= 17) tableSpot = "Relegation battle";
  else tableSpot = "Relegated";

  const avgRating = ratedMatches ? clamp(ratingSum / ratedMatches, 4, 9.8) : 5.8;
  const wonCup = Math.random() < 0.12;
  const trophies: string[] = [];
  if (tableSpot === "Champions") trophies.push(`League title, ${club.name}`);
  if (wonCup) trophies.push(`Cup run, ${club.name}`);

  const appearedTicks = ticks.filter((t) => t.appeared);
  let headlines: Headline[] = [];
  if (appearedTicks.length) {
    const best = appearedTicks.reduce((a, b) => (b.rating > a.rating ? b : a));
    const worst = appearedTicks.reduce((a, b) => (b.rating < a.rating ? b : a));
    const chosen = best === worst ? [best] : [best, worst];
    headlines = chosen.map((t) => ({ ...t, blurb: describeMatch(player, t) }));
  } else if (ticks.length) {
    headlines = [{ ...ticks[0], blurb: describeMatch(player, ticks[0]) }];
  }

  return { club: club.name, overall, wins, draws, losses, points, tableSpot, appearances, goals, assists, cleanSheets, avgRating, trophies, ticks, headlines, finalTable, tableSnapshots, leaguePosition, leagueSize: LEAGUE_SIZE };
}

export function performanceScore(result: SeasonResult): number {
  return result.goals * 1.2 + result.assists * 1.0 + result.cleanSheets * 0.8 + (result.avgRating - 6) * 8;
}

export function repDelta(result: SeasonResult): number {
  const tableBonus = result.tableSpot === "Champions" ? 6 : result.tableSpot === "Continental spot" ? 3 : result.tableSpot === "Relegated" ? -6 : 0;
  const perfBonus = clamp(Math.round(performanceScore(result) / 5), -10, 16);
  return tableBonus + perfBonus;
}

export function wageMultiplier(result: SeasonResult): number {
  const base = 1.06;
  const perf = clamp(performanceScore(result) / 260, -0.05, 0.28);
  const tableBonus = result.tableSpot === "Champions" ? 0.15 : result.tableSpot === "Relegated" ? -0.04 : 0;
  return clamp(base + perf + tableBonus, 0.9, 1.6);
}

export const PAGES: Record<Phase | "stats" | "squad", [string, string]> = {
  intro: ["P100", "HOME"],
  create: ["P101", "SIGNING"],
  create_goal: ["P102", "AMBITION"],
  youth: ["P110", "YOUTH"],
  preseason: ["P200", "PRE-SEASON"],
  simulating: ["P204", "VIDIPRINTER"],
  season_result: ["P205", "FULL-TIME"],
  coach_feedback: ["P206", "GAFFER'S VERDICT"],
  event: ["P207", "NEWSFLASH"],
  age_up: ["P299", "SEASON END"],
  trial: ["P250", "TRIAL WEEK"],
  trial_result: ["P251", "THE VERDICT"],
  retired: ["P400", "FINAL WHISTLE"],
  stats: ["P300", "DOSSIER"],
  squad: ["P301", "SQUAD ROOM"],
};

export type { Legacy };
