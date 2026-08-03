import clickUrl from "../assets/click.mp3";
import ambientHumUrl from "../assets/ambient-hum.mp3";
import ambientMelancholyUrl from "../assets/ambient-melancholy.mp3";
import ambientAggressiveUrl from "../assets/ambient-aggressive.mp3";
import ambientEpicUrl from "../assets/ambient-epic.mp3";
import ambientChiptuneUrl from "../assets/ambient-chiptune.mp3";
import meowUrl from "../assets/meow.ogg";

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
}

const STORAGE_KEY = "sound-settings";
const DEFAULT_SETTINGS: SoundSettings = { enabled: true, volume: 0.5 };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function readSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SETTINGS.enabled,
      volume: typeof parsed.volume === "number" ? clamp01(parsed.volume) : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(next: SoundSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort - e.g. localStorage disabled/full.
  }
}

let settings: SoundSettings = readSettings();

export function getSoundSettings(): SoundSettings {
  return { ...settings };
}

export function setSoundEnabled(enabled: boolean): SoundSettings {
  settings = { ...settings, enabled };
  writeSettings(settings);
  applyMasterGain();
  return settings;
}

export function setSoundVolume(volume: number): SoundSettings {
  settings = { ...settings, volume: clamp01(volume) };
  writeSettings(settings);
  applyMasterGain();
  return settings;
}

/**
 * Every click/ambient sound here is a real recording, not synthesized -
 * an earlier version of this module generated them procedurally via the
 * Web Audio API to sidestep licensing questions, but they sounded cheap
 * and thin in practice. All bundled files are CC0 (public domain) or
 * dedicated to the public domain, sourced and verified individually:
 *
 * - click.mp3: "Diamond Click (Luxury UI Click)" by LilMati, Freesound
 *   https://freesound.org/people/LilMati/sounds/703884/
 * - ambient-hum.mp3: "Industrial Factory/Fans Loop" by IanStarGem, Freesound
 *   https://freesound.org/people/IanStarGem/sounds/271096/
 * - ambient-melancholy.mp3: "AmbientLoop.wav" by IgalBlech, Freesound
 *   https://freesound.org/people/IgalBlech/sounds/399164/
 * - ambient-aggressive.mp3: "Experimental Drone" by Jedo, Freesound
 *   https://freesound.org/people/Jedo/sounds/396864/
 * - ambient-epic.mp3: "Em Pentatonic Pads 80bpm" by BuytheField, Freesound
 *   https://freesound.org/people/BuytheField/sounds/436130/
 * - ambient-chiptune.mp3: "8 bit arpeggio 001 major 120 bpm square 037 C4"
 *   by josefpres, Freesound
 *   https://freesound.org/people/josefpres/sounds/660386/
 * - meow.ogg: "Meow of a pleading cat", dedicated to the public domain,
 *   Wikimedia Commons
 *   https://commons.wikimedia.org/wiki/File:Meow_of_a_pleading_cat.oga
 *
 * Playback goes through the Web Audio API (not plain <audio> elements) so
 * every sound - click, ambient, meow - shares one master gain node driven
 * by the volume/enabled settings below, and ambient can crossfade between
 * theme profiles.
 */
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

/** Lazily creates the shared AudioContext and resumes it if suspended.
 * Browsers block audio output until a real user gesture - every exported
 * function here is only ever reached from one (the click-delegation
 * handler, or a settings change the user just made), so this resume call
 * is always inside a valid gesture call stack. */
function getContext(): { audioCtx: AudioContext; master: GainNode } {
  if (!ctx || !masterGain) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = settings.enabled ? settings.volume : 0;
    masterGain.connect(ctx.destination);
    // Kicks off fetch+decode for every ambient track now (decoding doesn't
    // need the context to be running, just to exist) rather than waiting
    // for a theme switch to request one - the biggest file (epic, ~3.7MB)
    // otherwise has a noticeable silent gap the first time a user ever
    // switches to Halo 3, since decode hasn't even started yet at that
    // point.
    for (const url of Object.values(AMBIENT_URLS)) {
      loadBuffer(ctx, url).catch(() => {});
    }
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return { audioCtx: ctx, master: masterGain };
}

function applyMasterGain(): void {
  if (!ctx || !masterGain) return;
  masterGain.gain.setTargetAtTime(settings.enabled ? settings.volume : 0, ctx.currentTime, 0.05);
}

// Decoded once per URL and reused - every subsequent play/loop just spins
// up a cheap new AudioBufferSourceNode against the same decoded buffer.
const bufferCache = new Map<string, Promise<AudioBuffer>>();

function loadBuffer(audioCtx: AudioContext, url: string): Promise<AudioBuffer> {
  let promise = bufferCache.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => audioCtx.decodeAudioData(data));
    bufferCache.set(url, promise);
  }
  return promise;
}

/** One short click sound, the same everywhere - not themed per preset,
 * reused for every interactive element app-wide (see the click-delegation
 * listener in App.tsx). */
export function playClick(): void {
  const { audioCtx, master } = getContext();
  loadBuffer(audioCtx, clickUrl)
    .then((buffer) => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      source.start();
    })
    .catch(() => {
      // Best-effort - e.g. decode failure.
    });
}

type AmbientProfile = "hum" | "melancholy" | "aggressive" | "epic" | "chiptune" | "none";

// Groups the 9 flavor theme presets into 5 distinct ambient characters
// rather than 9 shallow bespoke ones - a better time/quality tradeoff.
// Plain utility presets (dark/light/midnight/high-contrast/custom) get no
// ambient at all: picking one of those for a quiet, plain look shouldn't
// come with forced background noise.
const THEME_AMBIENT_PROFILES: Record<string, AmbientProfile> = {
  alien: "hum",
  "mgsv-idroid": "hum",
  "deus-ex": "hum",
  marathon: "hum",
  "disco-elysium": "melancholy",
  mgs1: "melancholy",
  ultrakill: "aggressive",
  halo3: "epic",
  "jesspring-io": "chiptune",
};

const AMBIENT_URLS: Record<Exclude<AmbientProfile, "none">, string> = {
  hum: ambientHumUrl,
  melancholy: ambientMelancholyUrl,
  aggressive: ambientAggressiveUrl,
  epic: ambientEpicUrl,
  chiptune: ambientChiptuneUrl,
};

// The "epic" track (a pentatonic pad piece) opens with a ~4s silent
// fade-in - confirmed by sampling its decoded channel data directly, not
// guessed. Every other track has audible content from t=0. Playback for
// this one profile starts partway in and loops from that same point (not
// back to the silent intro), so switching to Halo 3 doesn't sound like
// nothing happened for the first several seconds.
const AMBIENT_START_OFFSET_SECONDS: Partial<Record<Exclude<AmbientProfile, "none">, number>> = {
  epic: 5,
};

function profileForTheme(presetId: string): AmbientProfile {
  return THEME_AMBIENT_PROFILES[presetId] ?? "none";
}

interface AmbientHandle {
  gain: GainNode;
  stop: () => void;
}

function buildAmbientProfile(audioCtx: AudioContext, profile: AmbientProfile, destination: GainNode): AmbientHandle {
  const gain = audioCtx.createGain();
  gain.gain.value = 0; // faded in by the caller (setAmbientTheme)
  gain.connect(destination);

  let source: AudioBufferSourceNode | null = null;
  let cancelled = false;

  if (profile !== "none") {
    loadBuffer(audioCtx, AMBIENT_URLS[profile])
      .then((buffer) => {
        if (cancelled) return;
        const offset = AMBIENT_START_OFFSET_SECONDS[profile] ?? 0;
        source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = offset;
        source.connect(gain);
        source.start(0, offset);
      })
      .catch(() => {
        // Best-effort - e.g. decode failure, ambient just stays silent.
      });
  }

  return {
    gain,
    stop: () => {
      cancelled = true;
      try {
        source?.stop();
      } catch {
        // Already stopped - fine.
      }
    },
  };
}

let currentAmbient: { profile: AmbientProfile; handle: AmbientHandle } | null = null;

const AMBIENT_FADE_SECONDS = 0.4;

/** Crossfades to the given theme preset's ambient profile - a no-op if
 * it's already the active profile. Called from `themeStore.ts`'s
 * `applyTheme`, so every existing theme-change call site picks this up
 * for free. */
export function setAmbientTheme(presetId: string): void {
  const profile = profileForTheme(presetId);
  if (currentAmbient?.profile === profile) return;

  const { audioCtx, master } = getContext();
  const now = audioCtx.currentTime;

  const outgoing = currentAmbient;
  if (outgoing) {
    outgoing.handle.gain.gain.setTargetAtTime(0, now, AMBIENT_FADE_SECONDS / 3);
    setTimeout(() => outgoing.handle.stop(), AMBIENT_FADE_SECONDS * 1000 + 200);
  }

  if (profile === "none") {
    currentAmbient = null;
    return;
  }

  const handle = buildAmbientProfile(audioCtx, profile, master);
  handle.gain.gain.setTargetAtTime(1, now, AMBIENT_FADE_SECONDS / 3);
  currentAmbient = { profile, handle };
}

/** The hidden "meow" button's whole feature - see CS2DatabaseWidget.tsx. */
export function playMeow(): void {
  const { audioCtx, master } = getContext();
  loadBuffer(audioCtx, meowUrl)
    .then((buffer) => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      source.start();
    })
    .catch(() => {
      // Best-effort - e.g. decode failure.
    });
}
