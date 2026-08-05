import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ACADEMY_TIER_IDX,
  GOALS,
  NATIONS,
  NATION_KEYS,
  PAGES,
  POSITIONS,
  PRESEASON_CHOICES,
  PRO_TRIAL_CUTOFF_AGE,
  PRO_TRIAL_START_AGE,
  STAT_LABELS,
  STAT_MEANING,
  YOUTH_EVENTS,
  clamp,
  computeOverall,
  currentClub,
  eligibleEvents,
  firstName,
  generateCoachFeedback,
  generatePerformanceNote,
  generateSquad,
  newPlayer,
  ordinalSuffix,
  pick,
  proOfferChance,
  proOfferTier,
  repDelta,
  simulateSeason,
  statTier,
  wageMultiplier,
} from "./gameLogic";
import type { Choice, Goal, Legacy, NarrativeEvent, NationKey, Phase, Player, Position, PositionKey, SeasonResult, StatKey, TableRow, TrialResult, ViewMode } from "./types";

/* =========================================================
   THEME - old football vidiprinter / teletext screen
   ========================================================= */

const T = {
  bezel: "linear-gradient(160deg, #23262f 0%, #14161c 100%)",
  screen: "#0a0a0d",
  panel: "#101217",
  line: "#262a34",
  lineSoft: "#1a1d24",
  text: "#e7e4da",
  dim: "#82868f",
  yellow: "#f2c230",
  cyan: "#4fd3c4",
  green: "#4ecb86",
  red: "#e2564a",
};

const MONO = "'IBM Plex Mono', monospace";
const DISPLAY = "'VT323', monospace";

/* =========================================================
   SMALL UI PRIMITIVES
   ========================================================= */

function AsciiBar({ label, value, width = 14 }: { label: string; value: number; width?: number }) {
  const filled = Math.round((value / 99) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const color = value >= 75 ? T.green : value >= 55 ? T.cyan : T.dim;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: MONO }}>
      <span style={{ width: 34, color: T.dim }}>{label}</span>
      <span style={{ color, letterSpacing: "-1px" }}>{bar}</span>
      <span style={{ width: 26, textAlign: "right", color: T.text }}>{value}</span>
    </div>
  );
}

function Cursor() {
  return <span style={{ display: "inline-block", width: 9, height: 15, background: T.yellow, marginLeft: 4, animation: "oms-blink 1s steps(1) infinite", verticalAlign: "middle" }} />;
}

function PageHeader({ code, title, sub }: { code: string; title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `1px solid ${T.line}`, paddingBottom: 10, marginBottom: 18, flexWrap: "wrap", gap: 6 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 26, color: T.yellow, letterSpacing: 1 }}>
        {code} <span style={{ color: T.text }}>{title}</span>
        <Cursor />
      </div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 12, color: T.dim }}>{sub}</div>}
    </div>
  );
}

function ChoiceButton({ index, choice, onClick }: { index: number; choice: Choice; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        textAlign: "left",
        border: `1px solid ${hover ? T.yellow : T.line}`,
        background: hover ? T.lineSoft : "transparent",
        padding: "12px 14px",
        cursor: "pointer",
        fontFamily: MONO,
        color: T.text,
        display: "flex",
        gap: 12,
      }}
    >
      <span style={{ color: T.yellow, flexShrink: 0 }}>[{index + 1}]</span>
      <span>
        <div>{choice.label}</div>
        {choice.detail && <div style={{ fontSize: 12, color: hover ? T.cyan : T.dim, marginTop: 3 }}>{choice.detail}</div>}
      </span>
    </button>
  );
}

function BigButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: MONO,
        fontWeight: 600,
        padding: "12px 28px",
        border: `1px solid ${disabled ? T.line : T.yellow}`,
        background: disabled ? "transparent" : hover ? T.yellow : "transparent",
        color: disabled ? T.dim : hover ? "#0a0a0d" : T.yellow,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ fontFamily: MONO, padding: "12px 22px", border: `1px solid ${hover ? T.red : T.line}`, background: "transparent", color: T.text, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function Dossier({ player }: { player: Player }) {
  const overall = computeOverall(player.stats, player.position);
  const club = currentClub(player);
  const pos = POSITIONS[player.position];
  return (
    <div style={{ border: `1px solid ${T.line}`, background: T.panel, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 40, color: T.yellow, lineHeight: 1 }}>{overall}</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: 13, color: T.text }}>{player.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T.dim }}>{pos.label} &middot; {player.age}</div>
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: T.cyan, marginBottom: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {club.name} <span style={{ color: T.dim }}>&middot; {NATIONS[player.nation].label}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
          <AsciiBar key={k} label={STAT_LABELS[k]} value={player.stats[k]} />
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 10, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, color: T.dim }}>
        <span>REP {player.reputation}</span>
        <span>£{player.wage.toLocaleString()}/wk</span>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN GAME
   ========================================================= */

export function OneMoreSeasonGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [player, setPlayer] = useState<Player | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [pendingPosition, setPendingPosition] = useState<PositionKey | null>(null);
  const [pendingNation, setPendingNation] = useState<NationKey | null>(null);
  const [youthIdx, setYouthIdx] = useState(0);
  const [ticker, setTicker] = useState<SeasonResult["ticks"]>([]);
  const [seasonResult, setSeasonResult] = useState<SeasonResult | null>(null);
  const [currentEvent, setCurrentEvent] = useState<NarrativeEvent | null>(null);
  const [trialResult, setTrialResult] = useState<TrialResult | null>(null);
  const [legacy, setLegacy] = useState<Legacy | null>(null);
  const [view, setView] = useState<ViewMode>("career");
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tickTimer.current) clearInterval(tickTimer.current);
  }, []);

  function pickPosition(positionKey: PositionKey, nationKey: NationKey) {
    setPendingPosition(positionKey);
    setPendingNation(nationKey);
    setPhase("create_goal");
  }

  function pickGoal(goal: Goal) {
    if (!pendingPosition || !pendingNation) return;
    const p = newPlayer(nameInput.trim(), pendingPosition, goal, pendingNation);
    setPlayer(p);
    setYouthIdx(0);
    setPhase("youth");
  }

  function applyYouthChoice(choice: Choice) {
    if (!player) return;
    const updated = choice.apply(player, currentClub(player));
    if (youthIdx + 1 < YOUTH_EVENTS.length) {
      setPlayer(updated);
      setYouthIdx(youthIdx + 1);
    } else {
      // Everyone who comes through the youth events earns a place in a
      // real club's academy (not a straight-to-pro deal, and not a
      // national federation stand-in) - a name drawn from the nation's own
      // `clubPool`, shown as e.g. "AC Milan U21" via currentClub(). Age
      // stays 16 here - the pro trial pathway below is what decides when
      // (or whether) that changes.
      const homeClubName = pick(NATIONS[updated.nation].clubPool);
      const signed = {
        ...updated,
        clubTierIdx: ACADEMY_TIER_IDX,
        homeClubName,
        homeClubTierIdx: ACADEMY_TIER_IDX,
        wage: NATIONS[updated.nation].clubs[ACADEMY_TIER_IDX].wage,
      };
      setPlayer({ ...signed, squad: generateSquad(signed) });
      setPhase("preseason");
    }
  }

  function applyPreseason(choice: Choice) {
    if (!player) return;
    setPlayer(choice.apply(player, currentClub(player)));
    setPhase("simulating");
  }

  useEffect(() => {
    if (phase !== "simulating" || !player) return;
    const result = simulateSeason(player);
    setSeasonResult(result);
    setTicker([]);
    let i = 0;
    tickTimer.current = setInterval(() => {
      setTicker((t) => {
        if (i >= result.ticks.length) {
          if (tickTimer.current) clearInterval(tickTimer.current);
          setTimeout(() => setPhase("season_result"), 500);
          return t;
        }
        const next = [...t, result.ticks[i]];
        i++;
        return next;
      });
    }, 380);
    return () => {
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function acceptSeasonResult() {
    if (!player || !seasonResult) return;
    const totals = player.careerTotals;
    const newTotals = {
      appearances: totals.appearances + seasonResult.appearances,
      goals: totals.goals + seasonResult.goals,
      assists: totals.assists + seasonResult.assists,
      cleanSheets: totals.cleanSheets + seasonResult.cleanSheets,
      peakOverall: Math.max(totals.peakOverall, seasonResult.overall),
    };
    const newTrophies = [...player.trophies, ...seasonResult.trophies];
    const firstTrophyAge = player.firstTrophyAge === null && newTrophies.length > 0 ? player.age : player.firstTrophyAge;
    const updated: Player = {
      ...player,
      careerTotals: newTotals,
      trophies: newTrophies,
      firstTrophyAge,
      hasInvincibleSeason: player.hasInvincibleSeason || seasonResult.losses === 0,
      seasonsPlayed: player.seasonsPlayed + 1,
      seasonHistory: [
        ...player.seasonHistory,
        { season: player.seasonsPlayed + 1, age: player.age, club: seasonResult.club, tableSpot: seasonResult.tableSpot, leaguePosition: seasonResult.leaguePosition, leagueSize: seasonResult.leagueSize, apps: seasonResult.appearances, goals: seasonResult.goals, assists: seasonResult.assists, cs: seasonResult.cleanSheets, rating: seasonResult.avgRating.toFixed(1) },
      ],
      reputation: clamp(player.reputation + repDelta(seasonResult), 0, 100),
      wage: Math.round(player.wage * wageMultiplier(seasonResult)),
    };
    setPlayer(updated);
    setPhase("coach_feedback");
  }

  function proceedToEvent() {
    if (!player) return;
    setCurrentEvent(pick(eligibleEvents(player)));
    setPhase("event");
  }

  function applyEvent(choice: Choice) {
    if (!player) return;
    setPlayer(choice.apply(player, currentClub(player)));
    setPhase("age_up");
  }

  function continueCareer() {
    if (!player) return;
    const nextAge = player.age + 1;
    if (player.clubTierIdx === ACADEMY_TIER_IDX && nextAge >= PRO_TRIAL_START_AGE) {
      setPlayer({ ...player, age: nextAge });
      setPhase("trial");
      return;
    }
    if (nextAge >= 38) finishCareer({ ...player, age: nextAge });
    else {
      setPlayer({ ...player, age: nextAge });
      setPhase("preseason");
    }
  }

  function resolveTrial() {
    if (!player) return;
    const offered = Math.random() < proOfferChance(player);
    if (offered) {
      const tier = proOfferTier(player);
      // Promoted into the SAME club's first team, not shipped off to a
      // different named club - homeClubTierIdx moving to `tier` alongside
      // clubTierIdx is what makes currentClub() drop the "U21" suffix.
      const wage = NATIONS[player.nation].clubs[tier].wage;
      const signed = { ...player, clubTierIdx: tier, homeClubTierIdx: tier, wage };
      const withSquad = { ...signed, squad: generateSquad(signed) };
      setPlayer(withSquad);
      setTrialResult({ offered: true, club: currentClub(withSquad).name, wage });
    } else {
      setTrialResult({ offered: false });
    }
    setPhase("trial_result");
  }

  function endYouthCareer() {
    if (!player) return;
    // Deliberately bypasses finishCareer's score-tiered titles ("Hall of
    // Fame Icon" etc) - those are built for a completed pro career, and
    // would read strangely for someone who never got one.
    setLegacy({ score: 0, title: "Never Broke Through", achieved: false });
    setPhase("retired");
  }

  function finishCareer(finalPlayer: Player) {
    const t = finalPlayer.careerTotals;
    const score = t.goals * 2 + t.assists * 1.5 + t.cleanSheets * 1.2 + finalPlayer.trophies.length * 25 + t.peakOverall * 3 + t.appearances * 0.4;
    let title = "Honest Journeyman";
    if (score >= 700) title = "Hall of Fame Icon";
    else if (score >= 420) title = "National Treasure";
    else if (score >= 220) title = "Club Legend";
    const goal = finalPlayer.goal;
    const achieved = goal.metric(finalPlayer) >= goal.target;
    setLegacy({ score: Math.round(score), title, achieved });
    setPlayer(finalPlayer);
    setPhase("retired");
  }

  function resetGame() {
    setPhase("intro");
    setPlayer(null);
    setNameInput("");
    setPendingPosition(null);
    setPendingNation(null);
    setYouthIdx(0);
    setTicker([]);
    setSeasonResult(null);
    setCurrentEvent(null);
    setTrialResult(null);
    setLegacy(null);
    setView("career");
  }

  const navEnabled = player && phase !== "simulating";
  const [code, title] = view === "stats" ? PAGES.stats : view === "squad" ? PAGES.squad : PAGES[phase];

  return (
    <div style={{ minHeight: "100%", height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "#05060a", overflowY: "auto", boxSizing: "border-box" }}>
      <style>{`
        @keyframes oms-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes oms-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .oms-root * { box-sizing: border-box; }
        @media (min-width: 720px) { .oms-layout-grid { grid-template-columns: 1fr 230px !important; } }
      `}</style>

      <div className="oms-root" style={{ width: "100%", maxWidth: 800, background: T.bezel, padding: 14, borderRadius: 18, boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }}>
        <div
          style={{
            background: `repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px), ${T.screen}`,
            padding: "20px 22px",
            minHeight: 480,
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button
              onClick={onExit}
              style={{ fontFamily: MONO, fontSize: 11, color: T.dim, background: "transparent", border: `1px solid ${T.line}`, padding: "4px 10px", cursor: "pointer" }}
            >
              ✕ QUIT TO GAELJANK MENU
            </button>
          </div>

          <PageHeader code={code} title={title} sub={player ? `AGE ${player.age} · ${currentClub(player).name.toUpperCase()}` : "CAREER MODE"} />

          {navEnabled && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => setView((v) => (v === "squad" ? "career" : "squad"))}
                style={{ fontFamily: MONO, fontSize: 12, color: T.cyan, background: "transparent", border: `1px solid ${T.line}`, padding: "6px 14px", cursor: "pointer" }}
              >
                {view === "squad" ? "< BACK TO CAREER" : "SQUAD >"}
              </button>
              <button
                onClick={() => setView((v) => (v === "stats" ? "career" : "stats"))}
                style={{ fontFamily: MONO, fontSize: 12, color: T.cyan, background: "transparent", border: `1px solid ${T.line}`, padding: "6px 14px", cursor: "pointer" }}
              >
                {view === "stats" ? "< BACK TO CAREER" : "DOSSIER >"}
              </button>
            </div>
          )}

          {view === "stats" && player ? (
            <StatsScreen player={player} />
          ) : view === "squad" && player ? (
            <SquadScreen player={player} />
          ) : (
            <>
              {phase === "intro" && <IntroScreen onStart={() => setPhase("create")} />}
              {phase === "create" && <CreateScreen nameInput={nameInput} setNameInput={setNameInput} onPick={pickPosition} />}
              {phase === "create_goal" && <GoalScreen onPick={pickGoal} />}

              {phase === "youth" && player && (
                <NarrativeBody title={YOUTH_EVENTS[youthIdx].title} text={YOUTH_EVENTS[youthIdx].text(player, currentClub(player))} choices={YOUTH_EVENTS[youthIdx].choices} onChoose={applyYouthChoice} player={player} />
              )}

              {phase === "preseason" && player && (
                <NarrativeBody title="Setting your priorities" text="Pre-season is short. Where do you put the work in before the fixtures start piling up?" choices={PRESEASON_CHOICES} onChoose={applyPreseason} player={player} />
              )}

              {phase === "simulating" && player && <SimulatingScreen ticker={ticker} player={player} snapshots={seasonResult?.tableSnapshots} leagueSize={seasonResult?.leagueSize} />}
              {phase === "season_result" && seasonResult && player && <SeasonResultScreen result={seasonResult} player={player} onContinue={acceptSeasonResult} />}
              {phase === "coach_feedback" && player && <CoachScreen player={player} onContinue={proceedToEvent} />}

              {phase === "event" && player && currentEvent && (
                <NarrativeBody title={currentEvent.title} text={currentEvent.text(player, currentClub(player))} choices={currentEvent.choices} onChoose={applyEvent} player={player} />
              )}

              {phase === "age_up" && player && <AgeUpScreen player={player} onContinue={continueCareer} onRetire={() => finishCareer(player)} />}
              {phase === "trial" && player && <TrialScreen player={player} onResolve={resolveTrial} />}
              {phase === "trial_result" && player && trialResult && (
                <TrialResultScreen player={player} result={trialResult} onContinue={() => setPhase("preseason")} onGameOver={endYouthCareer} />
              )}
              {phase === "retired" && player && legacy && <RetiredScreen player={player} legacy={legacy} onReset={resetGame} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SCREENS
   ========================================================= */

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <div style={{ fontFamily: DISPLAY, fontSize: 52, color: T.text, marginBottom: 6, lineHeight: 1 }}>ONE MORE SEASON</div>
      <p style={{ fontFamily: MONO, color: T.dim, maxWidth: 480, marginBottom: 26, lineHeight: 1.7, fontSize: 14 }}>
        Sunday league to the very top, if you're good enough. Pick an ambition, live with every choice, and read your season back off the vidiprinter until
        the day you hang up your boots at 38.
      </p>
      <BigButton onClick={onStart}>START YOUR CAREER</BigButton>
    </div>
  );
}

function CreateScreen({
  nameInput,
  setNameInput,
  onPick,
}: {
  nameInput: string;
  setNameInput: (v: string) => void;
  onPick: (pos: PositionKey, nation: NationKey) => void;
}) {
  const [pos, setPos] = useState<PositionKey | null>(null);
  const [nation, setNation] = useState<NationKey | null>(null);
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: T.dim, marginBottom: 8, letterSpacing: 1 }}>NAME ON THE TEAMSHEET</div>
      <input
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        placeholder="Alex Rowntree"
        style={{ width: "100%", marginBottom: 22, background: "transparent", border: `1px solid ${T.line}`, padding: "10px 14px", color: T.text, fontFamily: MONO, fontSize: 14 }}
      />
      <div style={{ fontFamily: MONO, fontSize: 12, color: T.dim, marginBottom: 8, letterSpacing: 1 }}>WHERE DOES YOUR CAREER START?</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {NATION_KEYS.map((key) => {
          const n = NATIONS[key];
          return (
            <button
              key={key}
              onClick={() => setNation(key)}
              style={{ textAlign: "left", border: `1px solid ${nation === key ? T.yellow : T.line}`, background: nation === key ? T.lineSoft : "transparent", padding: "12px 14px", cursor: "pointer", fontFamily: MONO }}
            >
              <div style={{ color: T.text }}>{n.label}</div>
              <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>{n.blurb}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: T.dim, marginBottom: 8, letterSpacing: 1 }}>PICK YOUR POSITION</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {(Object.entries(POSITIONS) as [PositionKey, Position][]).map(([key, p]) => (
          <button
            key={key}
            onClick={() => setPos(key)}
            style={{ textAlign: "left", border: `1px solid ${pos === key ? T.yellow : T.line}`, background: pos === key ? T.lineSoft : "transparent", padding: "12px 14px", cursor: "pointer", fontFamily: MONO }}
          >
            <div style={{ color: T.text }}>
              {p.label} <span style={{ color: T.dim, fontSize: 11 }}>{p.tag}</span>
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>{p.blurb}</div>
          </button>
        ))}
      </div>
      <BigButton disabled={!pos || !nation} onClick={() => pos && nation && onPick(pos, nation)}>
        NEXT: PICK AN AMBITION
      </BigButton>
    </div>
  );
}

function GoalScreen({ onPick }: { onPick: (goal: Goal) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: T.dim, marginBottom: 8, letterSpacing: 1 }}>WHAT DO YOU WANT YOUR CAREER TO BE REMEMBERED FOR?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {GOALS.map((g) => (
          <button
            key={g.id}
            onClick={() => setSel(g.id)}
            style={{ textAlign: "left", border: `1px solid ${sel === g.id ? T.yellow : T.line}`, background: sel === g.id ? T.lineSoft : "transparent", padding: "12px 14px", cursor: "pointer", fontFamily: MONO }}
          >
            <div style={{ color: T.text }}>{g.label}</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>{g.desc}</div>
          </button>
        ))}
      </div>
      <BigButton disabled={!sel} onClick={() => { const g = GOALS.find((x) => x.id === sel); if (g) onPick(g); }}>
        LACE UP
      </BigButton>
    </div>
  );
}

function NarrativeBody({ title, text, choices, onChoose, player }: { title: string; text: string; choices: Choice[]; onChoose: (c: Choice) => void; player: Player }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 26, color: T.text, marginBottom: 10 }}>{title}</div>
        <p style={{ fontFamily: MONO, color: T.text, opacity: 0.9, marginBottom: 22, lineHeight: 1.7, fontSize: 14 }}>{text}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {choices.map((c, i) => (
            <ChoiceButton key={i} index={i} choice={c} onClick={() => onChoose(c)} />
          ))}
        </div>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function SimulatingScreen({
  ticker,
  player,
  snapshots,
  leagueSize,
}: {
  ticker: SeasonResult["ticks"];
  player: Player;
  snapshots?: Record<number, TableRow[]>;
  leagueSize?: number;
}) {
  const latestMd = ticker.length ? ticker[ticker.length - 1].md : null;
  const table = latestMd && snapshots ? snapshots[latestMd] : null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 26, color: T.text, marginBottom: 14 }}>THE VIDIPRINTER IS RUNNING...</div>
        <div style={{ border: `1px solid ${T.line}`, padding: "8px 14px", marginBottom: 16, fontFamily: MONO, fontSize: 13 }}>
          {ticker.length === 0 && <div style={{ color: T.dim }}>Kick-off...</div>}
          {ticker.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px dotted ${T.line}`, animation: "oms-rise 0.3s ease" }}>
              <span style={{ color: T.dim }}>MD{t.md}</span>
              <span style={{ color: T.text }}>vs {t.opp}</span>
              <span style={{ width: 20, textAlign: "center", color: t.result === "W" ? T.green : t.result === "D" ? T.yellow : T.red }}>{t.result}</span>
            </div>
          ))}
        </div>
        {table && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 8 }}>
              LEAGUE TABLE &middot; AFTER MATCHDAY {latestMd} OF 38 &middot; {leagueSize} CLUBS
            </div>
            <LeagueTable rows={table} />
          </div>
        )}
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function SeasonResultScreen({ result, player, onContinue }: { result: SeasonResult; player: Player; onContinue: () => void }) {
  const pos = POSITIONS[player.position];
  const [showTable, setShowTable] = useState(false);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 30, color: T.yellow, marginBottom: 2 }}>{result.tableSpot.toUpperCase()}</div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: T.dim, marginBottom: 18 }}>
          FINISHED {result.leaguePosition}{ordinalSuffix(result.leaguePosition)} OF {result.leagueSize} &middot; {result.wins}W {result.draws}D {result.losses}L &middot; {result.points} PTS &middot; {result.club}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 10, marginBottom: 14 }}>
          <MiniStat label="Apps" value={result.appearances} />
          {pos.primary.includes("shooting") && <MiniStat label="Goals" value={result.goals} />}
          {pos.primary.includes("passing") && <MiniStat label="Assists" value={result.assists} />}
          {pos.primary.includes("defending") && <MiniStat label="Clean sheets" value={result.cleanSheets} />}
          <MiniStat label="Avg rating" value={result.avgRating.toFixed(1)} />
        </div>

        <div style={{ fontFamily: MONO, fontSize: 12, color: T.dim, marginBottom: 20, lineHeight: 1.6, borderLeft: `2px solid ${T.cyan}`, paddingLeft: 10 }}>
          {generatePerformanceNote(player, result)}
        </div>

        {result.headlines.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 8 }}>MATCH REPORTS</div>
            {result.headlines.map((h, i) => (
              <div key={i} style={{ border: `1px solid ${T.line}`, padding: "10px 12px", marginBottom: 8, fontFamily: MONO }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.dim, marginBottom: 4 }}>
                  <span>MD{h.md} vs {h.opp}</span>
                  <span style={{ color: h.result === "W" ? T.green : h.result === "D" ? T.yellow : T.red }}>{h.result} &middot; {h.appeared ? h.rating.toFixed(1) : "DNP"}</span>
                </div>
                <div style={{ fontSize: 13, color: T.text }}>{h.blurb}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowTable((s) => !s)}
            style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, background: "transparent", border: `1px solid ${T.line}`, padding: "6px 12px", cursor: "pointer", marginBottom: showTable ? 10 : 0 }}
          >
            {showTable ? "HIDE FULL TABLE" : "SHOW FULL TABLE >"}
          </button>
          {showTable && <LeagueTable rows={result.finalTable} />}
        </div>

        {result.trophies.length > 0 && (
          <div style={{ border: `1px solid ${T.yellow}`, padding: "10px 14px", marginBottom: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.yellow, marginBottom: 4 }}>SILVERWARE</div>
            {result.trophies.map((t, i) => (
              <div key={i} style={{ fontFamily: MONO, color: T.text, fontSize: 13 }}>{t}</div>
            ))}
          </div>
        )}

        <BigButton onClick={onContinue}>CONTINUE</BigButton>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function CoachScreen({ player, onContinue }: { player: Player; onContinue: () => void }) {
  const s = player.seasonHistory[player.seasonHistory.length - 1];
  const feedback = generateCoachFeedback(player, { tableSpot: s.tableSpot, goals: s.goals, assists: s.assists, cleanSheets: s.cs, appearances: s.apps });
  const moodColor = feedback.mood === "pleased" ? T.green : feedback.mood === "concerned" ? T.red : T.yellow;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 26, color: T.text, marginBottom: 4 }}>
          {player.squad ? `${player.squad.manager.name.toUpperCase()} WANTS A WORD` : "THE GAFFER WANTS A WORD"}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: moodColor, marginBottom: 18, letterSpacing: 1 }}>MOOD: {feedback.mood.toUpperCase()}</div>
        <div style={{ border: `1px solid ${T.line}`, padding: "18px 20px", marginBottom: 22, fontFamily: MONO, fontSize: 15, color: T.text, lineHeight: 1.7, fontStyle: "italic" }}>"{feedback.quote}"</div>
        <BigButton onClick={onContinue}>HEAR HIM OUT</BigButton>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function LeagueTable({ rows, maxRows }: { rows: TableRow[]; maxRows?: number }) {
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.line}`, color: T.dim, textAlign: "left" }}>
            <th style={{ padding: "5px 6px" }}>#</th>
            <th style={{ padding: "5px 6px" }}>CLUB</th>
            <th style={{ padding: "5px 6px", textAlign: "right" }}>P</th>
            <th style={{ padding: "5px 6px", textAlign: "right" }}>W</th>
            <th style={{ padding: "5px 6px", textAlign: "right" }}>D</th>
            <th style={{ padding: "5px 6px", textAlign: "right" }}>L</th>
            <th style={{ padding: "5px 6px", textAlign: "right" }}>GD</th>
            <th style={{ padding: "5px 6px", textAlign: "right" }}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r.name} style={{ borderBottom: `1px dotted ${T.line}`, color: r.isPlayerClub ? T.yellow : T.text, background: r.isPlayerClub ? T.lineSoft : "transparent" }}>
              <td style={{ padding: "5px 6px" }}>{i + 1}</td>
              <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{r.name}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.played}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.won}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.drawn}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.lost}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.gf - r.ga}</td>
              <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, color: T.text }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: T.dim }}>{label.toUpperCase()}</div>
    </div>
  );
}

function AgeUpScreen({ player, onContinue, onRetire }: { player: Player; onContinue: () => void; onRetire: () => void }) {
  const canRetire = player.age >= 30;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 28, color: T.text, marginBottom: 10 }}>{firstName(player)} turns {player.age + 1}</div>
        <p style={{ fontFamily: MONO, color: T.dim, marginBottom: 24, fontSize: 14, lineHeight: 1.7 }}>
          {player.age + 1 >= 38 ? "The legs don't lie anymore. This has to be the last one." : canRetire ? "You could walk away now with your head held high, or push on for one more." : "Still plenty of miles left. Time for another campaign."}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <BigButton onClick={onContinue}>PLAY ON</BigButton>
          {canRetire && <GhostButton onClick={onRetire}>RETIRE NOW</GhostButton>}
        </div>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function TrialScreen({ player, onResolve }: { player: Player; onResolve: () => void }) {
  const club = currentClub(player);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 28, color: T.text, marginBottom: 10 }}>Trial week at {club.name}</div>
        <p style={{ fontFamily: MONO, color: T.dim, marginBottom: 24, fontSize: 14, lineHeight: 1.7 }}>
          {player.age >= PRO_TRIAL_CUTOFF_AGE
            ? `This is it. Turn ${player.age} without a professional contract and the academy will have to let ${firstName(player)} go.`
            : `The first-team scouts are running the rule over the academy squad this week. A professional contract could be one good session away.`}
        </p>
        <BigButton onClick={onResolve}>SEE WHAT THEY DECIDE</BigButton>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function TrialResultScreen({
  player,
  result,
  onContinue,
  onGameOver,
}: {
  player: Player;
  result: TrialResult;
  onContinue: () => void;
  onGameOver: () => void;
}) {
  const isFinalFailure = !result.offered && player.age >= PRO_TRIAL_CUTOFF_AGE;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 30, color: result.offered ? T.green : T.red, marginBottom: 10 }}>
          {result.offered ? "PROFESSIONAL CONTRACT OFFERED" : isFinalFailure ? "RELEASED" : "NOT THIS TIME"}
        </div>
        <p style={{ fontFamily: MONO, color: T.text, opacity: 0.9, marginBottom: 22, lineHeight: 1.7, fontSize: 14 }}>
          {result.offered
            ? `${result.club} have seen enough. ${firstName(player)} is turning professional on £${(result.wage ?? 0).toLocaleString()}/wk.`
            : isFinalFailure
              ? `No club came in. At ${player.age}, the academy can't keep ${firstName(player)} on any longer. The dream ends here.`
              : `Nothing this time - the scouts want to see more. There's still time to make a case before ${firstName(player)} ages out at ${PRO_TRIAL_CUTOFF_AGE}.`}
        </p>
        <BigButton onClick={isFinalFailure ? onGameOver : onContinue}>{isFinalFailure ? "ACCEPT YOUR FATE" : "CONTINUE"}</BigButton>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function RetiredScreen({ player, legacy, onReset }: { player: Player; legacy: Legacy; onReset: () => void }) {
  const t = player.careerTotals;
  const pos = POSITIONS[player.position];
  const goal = player.goal;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="oms-layout-grid">
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 34, color: T.yellow, marginBottom: 4 }}>{legacy.title.toUpperCase()}</div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: T.dim, marginBottom: 18 }}>
          {player.name} &middot; {player.seasonsPlayed} seasons &middot; legacy score {legacy.score}
          {player.caps > 0 ? ` · ${player.caps} caps (${player.capGoals} goals)` : ""}
        </div>

        <div style={{ border: `1px solid ${legacy.achieved ? T.green : T.line}`, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.dim, marginBottom: 4 }}>AMBITION: {goal.label.toUpperCase()}</div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: legacy.achieved ? T.green : T.text }}>
            {legacy.achieved ? "✔ ACHIEVED — " : "FELL SHORT — "}
            {goal.metric(player)}
            {goal.target > 1 ? `/${goal.target}` : ""} {goal.unit}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 10, marginBottom: 20 }}>
          <MiniStat label="Apps" value={t.appearances} />
          {pos.primary.includes("shooting") && <MiniStat label="Goals" value={t.goals} />}
          {pos.primary.includes("passing") && <MiniStat label="Assists" value={t.assists} />}
          {pos.primary.includes("defending") && <MiniStat label="Clean sheets" value={t.cleanSheets} />}
          <MiniStat label="Peak rating" value={t.peakOverall} />
        </div>

        {player.trophies.length > 0 ? (
          <div style={{ border: `1px solid ${T.yellow}`, padding: "10px 14px", marginBottom: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.yellow, marginBottom: 4 }}>CABINET</div>
            {player.trophies.map((tr, i) => (
              <div key={i} style={{ fontFamily: MONO, color: T.text, fontSize: 13 }}>{tr}</div>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: MONO, fontSize: 13, color: T.dim, marginBottom: 20 }}>No silverware this time round - that's the game.</p>
        )}

        <BigButton onClick={onReset}>START A NEW CAREER</BigButton>
      </div>
      <div>
        <Dossier player={player} />
      </div>
    </div>
  );
}

function SquadScreen({ player }: { player: Player }) {
  const squad = player.squad;
  const club = currentClub(player);
  if (!squad) {
    return <div style={{ fontFamily: MONO, color: T.dim, fontSize: 13 }}>No squad assembled yet - check back once you've signed your first contract.</div>;
  }
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 10 }}>{club.name.toUpperCase()} &middot; THE MANAGER</div>
      <div style={{ border: `1px solid ${T.line}`, padding: "12px 14px", marginBottom: 24 }}>
        <div style={{ fontFamily: MONO, color: T.text, fontSize: 14, marginBottom: 4 }}>{squad.manager.name}</div>
        <div style={{ fontFamily: MONO, color: T.dim, fontSize: 12 }}>{squad.manager.style}</div>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 10 }}>THE SQUAD</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {squad.teammates.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, padding: "8px 12px", fontFamily: MONO, fontSize: 12 }}>
            <span style={{ width: 32, color: T.yellow, flexShrink: 0 }}>{t.tag}</span>
            <span style={{ flex: 1, color: T.text, minWidth: 90 }}>{t.name}</span>
            <span style={{ width: 28, textAlign: "right", color: T.cyan, flexShrink: 0 }}>{t.rating}</span>
            <span style={{ flex: 1.4, color: T.dim, fontSize: 11 }}>{t.trait}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsScreen({ player }: { player: Player }) {
  const pos = POSITIONS[player.position];
  const goal = player.goal;
  const progress = clamp(Math.round((goal.metric(player) / goal.target) * 100), 0, 100);
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 10 }}>ATTRIBUTES &amp; WHAT THEY DRIVE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
          <div key={k}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
              <div style={{ maxWidth: 300 }}>
                <AsciiBar label={STAT_LABELS[k]} value={player.stats[k]} width={18} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 11, color: T.yellow }}>{statTier(player.stats[k])}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: T.dim, paddingLeft: 42 }}>{STAT_MEANING[k]}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 10 }}>INTERNATIONAL CAREER</div>
      <div style={{ border: `1px solid ${T.line}`, padding: "12px 14px", marginBottom: 24 }}>
        {player.caps === 0 ? (
          <div style={{ fontFamily: MONO, color: T.dim, fontSize: 13 }}>Uncapped so far - a big performance and the federation might come calling.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 10 }}>
            <MiniStat label="Caps" value={player.caps} />
            <MiniStat label="Goals" value={player.capGoals} />
            <MiniStat label="Debut age" value={player.debutCapAge ?? "-"} />
          </div>
        )}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 10 }}>AMBITION PROGRESS</div>
      <div style={{ border: `1px solid ${T.line}`, padding: "12px 14px", marginBottom: 24 }}>
        <div style={{ fontFamily: MONO, color: T.text, fontSize: 13, marginBottom: 6 }}>{goal.label}</div>
        <div style={{ fontFamily: MONO, color: T.dim, fontSize: 12, marginBottom: 8 }}>{goal.desc}</div>
        <AsciiBar label={progress + "%"} value={progress} width={24} />
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.cyan, marginBottom: 10 }}>CONTRIBUTIONS ON THE PITCH</div>
      <div style={{ overflowX: "auto", marginBottom: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.line}`, color: T.dim, textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>SEA</th>
              <th style={{ padding: "6px 8px" }}>AGE</th>
              <th style={{ padding: "6px 8px" }}>CLUB</th>
              <th style={{ padding: "6px 8px" }}>POS</th>
              <th style={{ padding: "6px 8px" }}>APP</th>
              {pos.primary.includes("shooting") && <th style={{ padding: "6px 8px" }}>G</th>}
              {pos.primary.includes("passing") && <th style={{ padding: "6px 8px" }}>A</th>}
              {pos.primary.includes("defending") && <th style={{ padding: "6px 8px" }}>CS</th>}
              <th style={{ padding: "6px 8px" }}>RTG</th>
            </tr>
          </thead>
          <tbody>
            {player.seasonHistory.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "10px 8px", color: T.dim }}>No seasons completed yet.</td>
              </tr>
            )}
            {player.seasonHistory.map((s) => (
              <tr key={s.season} style={{ borderBottom: `1px dotted ${T.line}`, color: T.text }}>
                <td style={{ padding: "6px 8px" }}>{s.season}</td>
                <td style={{ padding: "6px 8px" }}>{s.age}</td>
                <td style={{ padding: "6px 8px" }}>{s.club}</td>
                <td style={{ padding: "6px 8px" }}>{s.leaguePosition ? `${s.leaguePosition}/${s.leagueSize}` : s.tableSpot}</td>
                <td style={{ padding: "6px 8px" }}>{s.apps}</td>
                {pos.primary.includes("shooting") && <td style={{ padding: "6px 8px" }}>{s.goals}</td>}
                {pos.primary.includes("passing") && <td style={{ padding: "6px 8px" }}>{s.assists}</td>}
                {pos.primary.includes("defending") && <td style={{ padding: "6px 8px" }}>{s.cs}</td>}
                <td style={{ padding: "6px 8px" }}>{s.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
