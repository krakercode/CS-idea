/** A real historical figure (a documented person/event) vs a fictional
 * character (a game/book/film) - kept distinct so the UI never implies a
 * fictional line is a historical record. */
export type SpeakerType = "historical" | "fictional";

export interface Quote {
  id: string;
  text: string;
  speaker: string;
  speakerType: SpeakerType;
  /** The work/event this is from, e.g. "What Is to Be Done? (1902)". */
  work: string;
  /** When and why it was said/written - the "why does this line exist". */
  context: string;
  /** Where to verify it yourself, if available. */
  sourceUrl?: string;
}
