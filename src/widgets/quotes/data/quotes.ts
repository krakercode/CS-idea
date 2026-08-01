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
  {
    id: "sagan-pale-blue-dot-1994",
    text: "Look again at that dot. That's here. That's home. That's us. On it everyone you love, everyone you know, everyone you ever heard of, every human being who ever was, lived out their lives.",
    speaker: "Carl Sagan",
    speakerType: "historical",
    work: "Pale Blue Dot: A Vision of the Human Future in Space (1994)",
    context:
      "Sagan's reflection on the 1990 'Pale Blue Dot' photograph of Earth, taken by Voyager 1 from about 3.7 billion miles away at his own request as the probe left the solar system.",
    sourceUrl: "https://www.loc.gov/static/programs/national-recording-preservation-board/documents/pale-blue-dot.pdf",
  },
  {
    id: "feynman-cargo-cult-1974",
    text: "The first principle is that you must not fool yourself - and you are the easiest person to fool.",
    speaker: "Richard Feynman",
    speakerType: "historical",
    work: "\"Cargo Cult Science\", Caltech commencement address (1974)",
    context:
      "From Feynman's 1974 Caltech commencement speech on scientific integrity, later published in Caltech's Engineering and Science magazine - on the discipline of not fooling yourself before worrying about fooling anyone else.",
    sourceUrl: "https://calteches.library.caltech.edu/51/2/CargoCult.htm",
  },
  {
    id: "lovelace-note-g-1843",
    text: "The Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform.",
    speaker: "Ada Lovelace",
    speakerType: "historical",
    work: "Note G, \"Sketch of the Analytical Engine\" (1843)",
    context:
      "From Lovelace's own extensive notes appended to her translation of Luigi Menabrea's paper on Babbage's proposed Analytical Engine - widely cited as an early, prescient statement on the limits of what a computer can do without being told how.",
    sourceUrl: "https://www.fourmilab.ch/babbage/sketch.html",
  },
  {
    id: "woolf-room-of-ones-own-1929",
    text: "A woman must have money and a room of her own if she is to write fiction.",
    speaker: "Virginia Woolf",
    speakerType: "historical",
    work: "A Room of One's Own (1929)",
    context:
      "The essay's central claim, expanded from two lectures Woolf gave at Cambridge's women's colleges (Newnham and Girton) in October 1928, on the material conditions - literal financial independence and private space - that women writers had historically been denied.",
    sourceUrl: "https://victorianpersistence.files.wordpress.com/2013/03/a-room-of-ones-own-virginia-woolf-1929.pdf",
  },
  {
    id: "beauvoir-second-sex-1949",
    text: "One is not born, but rather becomes, woman.",
    speaker: "Simone de Beauvoir",
    speakerType: "historical",
    work: "The Second Sex, Book II (1949)",
    context:
      "The opening line of Book II of Le Deuxième Sexe - the foundational statement of what later became the sex/gender distinction, arguing femininity is shaped by society rather than biological destiny.",
    sourceUrl: "https://philpapers.org/rec/LEBQIN",
  },
  {
    id: "turing-computing-machinery-1950",
    text: "We can only see a short distance ahead, but we can see plenty there that needs to be done.",
    speaker: "Alan Turing",
    speakerType: "historical",
    work: "\"Computing Machinery and Intelligence\", Mind (1950)",
    context:
      "The closing line of the paper that proposed what's now called the Turing Test, published in the philosophy journal Mind - Turing's own assessment of how far off machine intelligence still was, with plenty of concrete work laid out regardless.",
    sourceUrl:
      "https://www.hec.edu/sites/default/files/documents/Computing%20Machinery%20and%20Intelligence%20by%20Alan%20Turing.pdf",
  },
  {
    id: "douglass-west-india-emancipation-1857",
    text: "If there is no struggle, there is no progress.",
    speaker: "Frederick Douglass",
    speakerType: "historical",
    work: "\"West India Emancipation\" speech, Canandaigua, NY (1857)",
    context:
      "Delivered on 3 August 1857 on the 23rd anniversary of British West Indian emancipation - Douglass's argument that abolition would come through struggle and demand, not appeals to conscience alone.",
    sourceUrl: "https://blackpast.org/african-american-history/1857-frederick-douglass-if-there-no-struggle-there-no-progress/",
  },
  {
    id: "baldwin-as-much-truth-1962",
    text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.",
    speaker: "James Baldwin",
    speakerType: "historical",
    work: "\"As Much Truth As One Can Bear\", The New York Times Book Review (1962)",
    context:
      "From an essay published 14 January 1962 on American writers' reluctance to confront the country's history honestly - often misattributed to The Fire Next Time, but actually from this earlier Times piece.",
    sourceUrl: "https://wist.info/baldwin-james/1227/",
  },
  {
    id: "morrison-nobel-lecture-1993",
    text: "We die. That may be the meaning of life. But we do language. That may be the measure of our lives.",
    speaker: "Toni Morrison",
    speakerType: "historical",
    work: "Nobel Lecture in Literature (1993)",
    context:
      "Delivered 7 December 1993, when Morrison became the first African American woman to receive the Nobel Prize in Literature - the lecture's closing reflection on language as what outlives us.",
    sourceUrl: "https://www.nobelprize.org/prizes/literature/1993/morrison/lecture/",
  },
  {
    id: "le-guin-national-book-award-2014",
    text: "We live in capitalism, its power seems inescapable - but then, so did the divine right of kings. Any human power can be resisted and changed by human beings.",
    speaker: "Ursula K. Le Guin",
    speakerType: "historical",
    work: "National Book Foundation Medal acceptance speech (2014)",
    context:
      "Delivered 19 November 2014 on receiving the National Book Foundation's Medal for Distinguished Contribution to American Letters - a pointed critique of publishing-as-commodity aimed at the industry executives in the room.",
    sourceUrl: "https://www.ursulakleguin.com/nbf-medal",
  },
  {
    id: "wollstonecraft-vindication-1792",
    text: "It is justice, not charity, that is wanting in the world.",
    speaker: "Mary Wollstonecraft",
    speakerType: "historical",
    work: "A Vindication of the Rights of Woman (1792)",
    context:
      "From Wollstonecraft's foundational feminist treatise, arguing that women's subordination was a matter of denied rights and education, not something to be remedied by male benevolence.",
    sourceUrl: "https://oll.libertyfund.org/people/mary-wollstonecraft/quotes",
  },
  {
    id: "wittgenstein-tractatus-1921",
    text: "Whereof one cannot speak, thereof one must be silent.",
    speaker: "Ludwig Wittgenstein",
    speakerType: "historical",
    work: "Tractatus Logico-Philosophicus, proposition 7 (1921)",
    context:
      "The single-sentence closing proposition of Wittgenstein's first major work - the limit he draws around what language and logic can meaningfully address at all.",
    sourceUrl: "https://www.siue.edu/~wlarkin/teaching/PHIL309/tractatus.html",
  },
  {
    id: "kahlo-diary-1953",
    text: "Feet, what do I need you for when I have wings to fly?",
    speaker: "Frida Kahlo",
    speakerType: "historical",
    work: "The Diary of Frida Kahlo (entry c. 1953, published 1995)",
    context:
      "Written not long before doctors amputated her right leg below the knee in August 1953, after years of illness and injury - exact translated wording varies slightly between editions of the diary.",
    sourceUrl: "https://www.denverartmuseum.org/en/blog/quotes-frida-kahlo",
  },
  {
    id: "carson-silent-spring-1962",
    text: "In nature nothing exists alone.",
    speaker: "Rachel Carson",
    speakerType: "historical",
    work: "Silent Spring (1962)",
    context:
      "From Carson's book on the ecological damage of pesticides like DDT, credited with helping launch the modern environmental movement - a one-line statement of the book's central point about interconnected ecosystems.",
    sourceUrl: "https://www.goodreads.com/quotes/479687-in-nature-nothing-exists-alone",
  },
  {
    id: "lorde-masters-tools-1979",
    text: "The master's tools will never dismantle the master's house.",
    speaker: "Audre Lorde",
    speakerType: "historical",
    work: "\"The Master's Tools Will Never Dismantle the Master's House\" (1979, published in Sister Outsider, 1984)",
    context:
      "Originally delivered in 1979 as a response at an NYU conference marking the 30th anniversary of Simone de Beauvoir's The Second Sex, later collected in Lorde's Sister Outsider (1984) - a critique of relying on the oppressor's own frameworks to seek liberation.",
    sourceUrl: "https://www.univ.ox.ac.uk/book/the-masters-tools/",
  },
  {
    id: "darwin-origin-of-species-1859",
    text: "There is grandeur in this view of life, with its several powers, having been originally breathed into a few forms or into one; and that, whilst this planet has gone cycling on according to the fixed law of gravity, from so simple a beginning endless forms most beautiful and most wonderful have been, and are being, evolved.",
    speaker: "Charles Darwin",
    speakerType: "historical",
    work: "On the Origin of Species, 1st edition (1859)",
    context:
      "The closing sentence of the book, and Darwin's first use of the word 'evolved' in print in this context. Later editions from 1860 onward insert 'by the Creator' after 'breathed' - the wording above is the original 1859 text.",
    sourceUrl: "https://www.age-of-the-sage.org/charles_darwins/quotes/grandeur_view_life.htm",
  },
  {
    id: "anthony-final-speech-1906",
    text: "Failure is impossible.",
    speaker: "Susan B. Anthony",
    speakerType: "historical",
    work: "Final public speech, Washington, D.C. (1906)",
    context:
      "Said in one of her last public appearances, weeks before her death on 13 March 1906 - fourteen years before the 19th Amendment she'd spent her life campaigning for was ratified. Often mistakenly attributed to her 1873 voting trial speech, which predates it by over 30 years.",
    sourceUrl: "https://famous-trials.com/anthony/440",
  },
];
