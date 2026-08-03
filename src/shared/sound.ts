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

// Every click/ambient sound is synthesized at runtime via the Web Audio
// API - not a licensing workaround, a better fit: zero bundle size, zero
// attribution/redistribution questions, and trivial to vary per theme
// (frequency/waveform/filter) which is exactly what the ambient profiles
// below need. The one exception is `playMeow` - a synthesized cat sound
// would read as a joke, not a cat, so that one is a real sample (see its
// doc comment for the source/license).
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

/** One short synthesized blip, the same everywhere - not themed per
 * preset, reused for every interactive element app-wide (see the
 * click-delegation listener in App.tsx). */
export function playClick(): void {
  const { audioCtx, master } = getContext();
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.12);
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

function profileForTheme(presetId: string): AmbientProfile {
  return THEME_AMBIENT_PROFILES[presetId] ?? "none";
}

interface AmbientHandle {
  gain: GainNode;
  stop: () => void;
}

function createNoiseBuffer(audioCtx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(audioCtx.sampleRate * seconds);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function buildAmbientProfile(audioCtx: AudioContext, profile: AmbientProfile, destination: GainNode): AmbientHandle {
  const gain = audioCtx.createGain();
  gain.gain.value = 0; // faded in by the caller (setAmbientTheme)
  gain.connect(destination);

  const now = audioCtx.currentTime;
  const stopFns: Array<() => void> = [];

  function addOscillator(freq: number, type: OscillatorType, level: number) {
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    oscGain.gain.value = level;
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start(now);
    stopFns.push(() => osc.stop());
  }

  function addFilteredNoise(level: number, filterFreq: number) {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer(audioCtx, 2);
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = level;
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(gain);
    source.start(now);
    stopFns.push(() => source.stop());
  }

  // A slow, quantized square-wave arpeggio - rescheduled on an interval
  // (rather than a long precomputed Web Audio schedule) so it keeps
  // looping indefinitely for however long the app stays open.
  function addChiptuneArpeggio(notesHz: number[], stepMs: number, level: number) {
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = "square";
    oscGain.gain.value = level;
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start(now);
    let step = 0;
    const intervalId = window.setInterval(() => {
      osc.frequency.setValueAtTime(notesHz[step % notesHz.length], audioCtx.currentTime);
      step += 1;
    }, stepMs);
    stopFns.push(() => {
      window.clearInterval(intervalId);
      osc.stop();
    });
  }

  switch (profile) {
    case "hum":
      // A cold, idling-terminal feel - a low sine drone under filtered noise.
      addOscillator(60, "sine", 0.5);
      addFilteredNoise(0.15, 400);
      break;
    case "melancholy":
      // Two slightly detuned sine pads for a slow, warm, wide texture.
      addOscillator(110, "sine", 0.35);
      addOscillator(110 * 1.005, "sine", 0.35);
      break;
    case "aggressive":
      addOscillator(55, "sawtooth", 0.25);
      addFilteredNoise(0.3, 900);
      break;
    case "epic":
      // A harmonic chord (root/fifth/octave) for a warm, spacious feel.
      addOscillator(65.4, "sine", 0.3); // C2
      addOscillator(98.0, "sine", 0.22); // G2
      addOscillator(130.8, "sine", 0.18); // C3
      break;
    case "chiptune":
      addChiptuneArpeggio([261.63, 329.63, 392.0, 329.63], 500, 0.12);
      break;
    case "none":
    default:
      break;
  }

  return {
    gain,
    stop: () => {
      for (const fn of stopFns) {
        try {
          fn();
        } catch {
          // Already stopped - fine.
        }
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

let meowAudio: HTMLAudioElement | null = null;

/**
 * The hidden "meow" button's whole feature - see CS2DatabaseWidget.tsx.
 * Sourced from Wikimedia Commons' "Meow of a pleading cat" recording,
 * dedicated to the public domain (CC0) - saved here as meow.ogg (same Ogg
 * Vorbis container, renamed from the original .oga extension since Vite's
 * built-in asset types don't recognize .oga):
 * https://commons.wikimedia.org/wiki/File:Meow_of_a_pleading_cat.oga
 */
export function playMeow(): void {
  if (!settings.enabled) return;
  if (!meowAudio) {
    meowAudio = new Audio(meowUrl);
  }
  meowAudio.volume = settings.volume;
  meowAudio.currentTime = 0;
  void meowAudio.play().catch(() => {
    // Best-effort - e.g. autoplay still blocked for some reason.
  });
}
