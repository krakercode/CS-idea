export type StatKey = "pace" | "shooting" | "passing" | "defending" | "physical" | "mental";
export type Stats = Record<StatKey, number>;

export type PositionKey = "striker" | "winger" | "midfielder" | "defender";

export interface Position {
  label: string;
  tag: string;
  blurb: string;
  primary: StatKey[];
  secondary: StatKey[];
}

export type NationKey = "england" | "scotland" | "spain" | "germany" | "italy";

export interface ClubTier {
  name: string;
  strength: number;
  wage: number;
}

export interface Nation {
  label: string;
  blurb: string;
  clubs: ClubTier[];
  clubPool: string[];
}

export interface Goal {
  id: string;
  label: string;
  desc: string;
  target: number;
  unit: string;
  metric: (p: Player) => number;
}

export interface CareerTotals {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  peakOverall: number;
}

export interface SeasonHistoryEntry {
  season: number;
  age: number;
  club: string;
  tableSpot: string;
  leaguePosition: number;
  leagueSize: number;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  rating: string;
}

export interface Teammate {
  name: string;
  tag: string;
  label: string;
  trait: string;
  rating: number;
}

export interface Manager {
  name: string;
  style: string;
}

export interface Squad {
  manager: Manager;
  teammates: Teammate[];
}

export interface Player {
  name: string;
  position: PositionKey;
  goal: Goal;
  nation: NationKey;
  age: number;
  stats: Stats;
  reputation: number;
  wage: number;
  clubTierIdx: number;
  trophies: string[];
  careerTotals: CareerTotals;
  seasonsPlayed: number;
  seasonHistory: SeasonHistoryEntry[];
  hasInvincibleSeason: boolean;
  firstTrophyAge: number | null;
  caps: number;
  capGoals: number;
  debutCapAge: number | null;
  squad: Squad | null;
}

export interface Choice {
  label: string;
  detail?: string;
  apply: (p: Player, club: ClubTier) => Player;
}

export interface NarrativeEvent {
  /** Stable identifier for eligibility filtering (see `eligibleEvents`) -
   * kept separate from `title` so editing the display copy can never
   * silently break which events are gated to which career stage. */
  id: string;
  title: string;
  text: (p: Player, club: ClubTier) => string;
  choices: Choice[];
}

export type MatchResultLetter = "W" | "D" | "L" | null;

export interface Tick {
  md: number;
  opp: string;
  result: MatchResultLetter;
  appeared: boolean;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  rating: number;
}

export interface Headline extends Tick {
  blurb: string;
}

export interface TableRow {
  name: string;
  isPlayerClub: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface LeagueClub {
  name: string;
  strength: number;
}

export interface SeasonResult {
  club: string;
  overall: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  tableSpot: string;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  avgRating: number;
  trophies: string[];
  ticks: Tick[];
  headlines: Headline[];
  finalTable: TableRow[];
  tableSnapshots: Record<number, TableRow[]>;
  leaguePosition: number;
  leagueSize: number;
}

export interface Legacy {
  score: number;
  title: string;
  achieved: boolean;
}

export type Phase =
  | "intro"
  | "create"
  | "create_goal"
  | "youth"
  | "preseason"
  | "simulating"
  | "season_result"
  | "coach_feedback"
  | "event"
  | "age_up"
  | "trial"
  | "trial_result"
  | "retired";

export type ViewMode = "career" | "stats" | "squad";

/** Outcome of a single pro-trial roll (see `proOfferChance`/`proOfferTier`
 * in gameLogic.ts) - `club`/`wage` are only set when `offered` is true. */
export interface TrialResult {
  offered: boolean;
  club?: string;
  wage?: number;
}
