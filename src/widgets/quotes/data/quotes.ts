import type { Quote } from "../types";

/**
 * Curated quotes - kept deliberately small rather than padded out with
 * anything that "sounds right." Every historical quote here was
 * cross-checked against multiple independent sources during a live web
 * search (not pulled from memory alone) before being included, specifically
 * to avoid the extremely common problem of misattributed/apocryphal
 * "famous quotes" (e.g. most viral Napoleon quotes floating around the
 * internet have no real primary source - several were deliberately left
 * out of this list for exactly that reason). Even so: translations vary
 * and secondary sources can still be wrong, so treat `sourceUrl` as a
 * starting point for your own check, not a guarantee.
 *
 * Volition is a skill/inner voice from Disco Elysium (ZA/UM, 2019), not a
 * real person - its lines are exact, verified game dialogue, marked
 * `speakerType: "fictional"` so the widget never presents it as history.
 */
export const QUOTES: Quote[] = [
  {
    id: "napoleon-fontainebleau-1814",
    text: "Soldiers of my Old Guard: I bid you farewell. For twenty years I have constantly accompanied you on the road to honor and glory. I have sacrificed all of my interests to those of the country. I go, but you, my friends, will continue to serve France. Do not regret my fate; if I have consented to survive, it is to serve your glory.",
    speaker: "Napoleon Bonaparte",
    speakerType: "historical",
    work: "Farewell to the Old Guard, Fontainebleau",
    context:
      "Delivered in the courtyard of the Château de Fontainebleau on 20 April 1814, days after his forced abdication, to the Imperial Guard soldiers who had served alongside him since Italy and Egypt. Recorded by officers present and published in multiple first-hand memoirs of the period.",
    sourceUrl:
      "https://www.napoleon.org/en/history-of-the-two-empires/articles/napoleons-adieux-to-the-old-guard-at-fontainebleau-20-april-1814/",
  },
  {
    id: "napoleon-letter-josephine-1795",
    text: "I awake full of you. Your image and the memory of last night's intoxicating pleasures has left no rest to my senses.",
    speaker: "Napoleon Bonaparte",
    speakerType: "historical",
    work: "Letter to Joséphine de Beauharnais",
    context:
      "Written in Paris around December 1795, during his brief and intense courtship of Joséphine, a few months before their marriage in March 1796. One of many surviving letters later published in his collected correspondence.",
    sourceUrl: "https://www.napoleonguide.com/lovejos1.htm",
  },
  {
    id: "lenin-what-is-to-be-done-1902",
    text: "Without revolutionary theory there can be no revolutionary movement.",
    speaker: "Vladimir Lenin",
    speakerType: "historical",
    work: "What Is to Be Done? (1902)",
    context:
      "From the opening chapter of this pamphlet, written in 1901-1902 against the 'Economist' faction of Russian Marxists, who Lenin argued were too focused on immediate trade-union demands at the expense of building disciplined revolutionary organization.",
    sourceUrl: "https://www.marxists.org/archive/lenin/works/1901/witbd/",
  },
  {
    id: "lenin-finland-station-1917",
    text: "The people need peace; the people need bread; the people need land. And they give you war, hunger, no bread.",
    speaker: "Vladimir Lenin",
    speakerType: "historical",
    work: "Speech at the Finland Station, Petrograd",
    context:
      "Delivered from atop an armored car to a crowd of supporters on 16 April 1917, minutes after Lenin's return to Russia from exile in Switzerland. Set the tone for the campaign - and the slogan 'Peace, Land, Bread' - that led to the October Revolution.",
    sourceUrl: "https://www.marxists.org/archive/lenin/works/1917/apr/03.htm",
  },
  {
    id: "volition-opening",
    text: "You can do it.",
    speaker: "Volition",
    speakerType: "fictional",
    work: "Disco Elysium (ZA/UM, 2019) - opening sequence",
    context:
      "One of the first lines of the game, spoken as the amnesiac protagonist claws toward consciousness after a three-day bender - Volition's quiet counter to the Ancient Reptilian Brain, which is urging him to just stay unconscious.",
  },
  {
    id: "volition-balcony",
    text: "No. This is somewhere to be. This is all you have, but it's still something. Streets and sodium lights. The sky, the world. You're still alive.",
    speaker: "Volition",
    speakerType: "fictional",
    work: "Disco Elysium (ZA/UM, 2019) - balcony scene",
    context:
      "Spoken if the player has the detective look down from a balcony and think about jumping. One of the game's most-quoted lines - a real moment of comfort delivered as a video game skill check.",
  },
  {
    id: "volition-ending",
    text: "In honour of your will, lieutenant-yefreitor. That you kept from falling apart, in the face of sheer terror. Day after day. Second by second.",
    speaker: "Volition",
    speakerType: "fictional",
    work: "Disco Elysium (ZA/UM, 2019) - late game",
    context:
      "Said late in the game - Volition effectively awarding the player character a private medal for simply having endured. About as close as the game gets to an emotional payoff for the whole investigation.",
  },
];
