// our-sky — demo data layer (M0 prototype)
// ALL identities below are fictional: every name, handle, email, and birth detail
// is invented for the mockups and matches no real person. Reading copy follows
// the voice of the reference screenshots.

export type Body =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export type Sign =
  | 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo'
  | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

export const BODY_GLYPH: Record<Body, string> = {
  sun: '☉', moon: '☾', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
};

export const SIGN_GLYPH: Record<Sign, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

export const SIGN_ORDER: Sign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export const HOUSES: Record<number, string> = {
  1: 'self & identity', 2: 'money & values', 3: 'communication', 4: 'home & roots',
  5: 'pleasure & creation', 6: 'work & health', 7: 'partnership', 8: 'sex & death',
  9: 'philosophy & travel', 10: 'career & status', 11: 'friends & hopes', 12: 'the subconscious',
};

export interface Placement {
  body: Body;
  sign: Sign;
  deg: number;       // degrees within sign, 0–29.99
  house: number;
  retro?: boolean;
}

export interface Reading {
  key: string;
  title: string;
  paras: string[];
  similar?: { handle?: string; name?: string }[];
  cta?: { heart?: boolean; label: string };
  art?: string;      // art asset shown near this card
  receipts?: string; // mono footnote, e.g. "28°15' · TWELFTH HOUSE · PLACIDUS"
}

/* ---------------- the demo chart (You) ---------------- */

export const USER = {
  name: 'Nova Reyes',
  handle: '@novareyes',
  born: 'November 20, 1998 · 6:12 AM · Portland, OR',
  bigThree: { sun: 'Scorpio' as Sign, moon: 'Aries' as Sign, rising: 'Cancer' as Sign },
};

export const CHART: Placement[] = [
  { body: 'sun',      sign: 'Scorpio',     deg: 28.25,  house: 12 },
  { body: 'moon',     sign: 'Aries',       deg: 11.4,   house: 10 },
  { body: 'mercury',  sign: 'Scorpio',     deg: 14.02,  house: 5 },
  { body: 'venus',    sign: 'Cancer',      deg: 21.36,  house: 1 },
  { body: 'mars',     sign: 'Cancer',      deg: 9.18,   house: 1 },
  { body: 'jupiter',  sign: 'Pisces',      deg: 26.5,   house: 9 },
  { body: 'saturn',   sign: 'Taurus',      deg: 15.12,  house: 11 },
  { body: 'uranus',   sign: 'Aquarius',    deg: 9.44,   house: 8 },
  { body: 'neptune',  sign: 'Aquarius',    deg: 28.51,  house: 7 },
  { body: 'pluto',    sign: 'Sagittarius', deg: 9.03,   house: 6 },
];

export const ASC = { sign: 'Cancer' as Sign, deg: 5.2 };
export const MC = { sign: 'Pisces' as Sign, deg: 18.4 };

export const ASPECTS = [
  { a: 'venus' as Body, b: 'moon' as Body, type: 'trine', orb: 2.1 },
  { a: 'sun' as Body, b: 'pluto' as Body, type: 'sextile', orb: 1.4 },
  { a: 'moon' as Body, b: 'mars' as Body, type: 'square', orb: 2.2 },
  { a: 'venus' as Body, b: 'neptune' as Body, type: 'trine', orb: 0.9 },
  { a: 'saturn' as Body, b: 'sun' as Body, type: 'quincunx', orb: 3.1 },
];

/* ---------------- readings (You → Chart) ---------------- */

export const READINGS: Reading[] = [
  {
    key: 'sun:scorpio:house12',
    title: 'Sun in Scorpio',
    paras: [
      'The sun determines your ego, identity, and "role" in life. It\'s the core of who you are, and is the sign you most likely already know. Your Sun is in Scorpio, meaning you have a fundamental urge to get to the bottom of things, which can at times lead you to be manipulative or power-hungry, but it comes down to an intense passion for authenticity, real intimacy, and the truth.',
      'It\'s in your twelfth house, meaning much of this happens privately — you metabolize identity away from the audience, and you show people the version of yourself that has already survived the editing room.',
    ],
    similar: [{ name: 'Rowan Voss' }],
    art: 'moon',
    receipts: "28°15′ · TWELFTH HOUSE · PLACIDUS",
  },
  {
    key: 'moon:aries:house10',
    title: 'Moon in Aries',
    paras: [
      'The moon determines how you process feeling, what you need to feel safe, and the private reflex beneath the personality. Your Moon is in Aries, meaning your emotions arrive first and get explained later — you feel in bursts, you recover fast, and you would rather have the ugly truth now than a kind silence you have to decode.',
      'It\'s in your tenth house, meaning your feelings are public infrastructure — the whole room reads your weather before you say a word, and your moods quietly steer your ambition.',
    ],
    receipts: "11°24′ · TENTH HOUSE · PLACIDUS",
  },
  {
    key: 'mercury:scorpio:house5',
    title: 'Mercury in Scorpio',
    paras: [
      'Mercury determines how you think, speak, and listen. Your Mercury is in Scorpio, meaning your mind is a scalpel — you ask the second question, you remember the exact words people used, and small talk feels like a tax you pay to access the real conversation.',
      'It\'s in your fifth house, meaning you think in order to play and to create — wit, flirtation, and invention are how your intelligence relaxes.',
    ],
    similar: [{ handle: '@maraellison33' }],
    receipts: "14°01′ · FIFTH HOUSE · PLACIDUS",
  },
  {
    key: 'venus:cancer:house1',
    title: 'Venus in Cancer',
    paras: [
      "Venus determines how and what you love. It indicates how you express affection and the qualities you're attracted to. Your Venus is in Cancer, meaning your romantic side is gentle, thoughtful, and sentimental. You love being tender, kind, and nurturing to the people you love. You're intensely loyal, but this may stem from a fear of rejection.",
      "It's in your first house, meaning that for you, love is often expressed in your self and self-image—and, because it's your first house, your Venus in Cancer is hyper-present in your personality.",
    ],
    cta: { heart: true, label: 'Your relationship analysis' },
    art: 'dove',
    receipts: "21°21′ · FIRST HOUSE · PLACIDUS",
  },
  {
    key: 'mars:cancer:house1',
    title: 'Mars in Cancer',
    paras: [
      "Mars is the planet of aggression. It determines how you assert yourself, take action, and the energy that surrounds you—particularly in your sex life, your ambitiousness, and when you're angry. Your Mars is in Cancer, meaning you assert yourself in a way that is emotional and somewhat passive-aggressive, and you push things forward only when you feel safe and secure.",
      "It's in your first house, meaning you put a lot of energy into your self and self-image—and, because it's your first house, the armor is visible: people feel the tide of you before they hear you speak.",
    ],
    art: 'dove',
    receipts: "09°10′ · FIRST HOUSE · PLACIDUS",
  },
  {
    key: 'jupiter:pisces:house9',
    title: 'Jupiter in Pisces',
    paras: [
      'Jupiter rules luck, expansion, and belief — the part of the chart that grows whatever it touches. Your Jupiter is in Pisces, meaning your faith lives in the unsayable: art, water, dreams, the feeling of a room after someone leaves it. Luck finds you when you stop insisting on the plan.',
      "It's in your ninth house, meaning you expand through distance — other cities, other disciplines, other people's gods. Your philosophy is assembled, not inherited.",
    ],
    receipts: "26°30′ · NINTH HOUSE · PLACIDUS",
  },
  {
    key: 'saturn:taurus:house11',
    title: 'Saturn in Taurus',
    paras: [
      'Saturn rules responsibility, limitation, fear, and discipline. Saturn in Taurus means you can be overly conservative, unimaginative, and indulgent.',
      "It's in your eleventh house, meaning you experience difficulty surrounding social status, friendships, and hopes and dreams.",
    ],
    similar: [{ name: 'Rowan Voss' }],
    art: 'skull',
    receipts: "15°07′ · ELEVENTH HOUSE · PLACIDUS",
  },
  {
    key: 'uranus:aquarius:house8',
    title: 'Uranus in Aquarius',
    paras: [
      'Uranus changes signs every seven years, ruling innovation, rebellion, and progress. Your Uranus is in Aquarius, meaning your generation is forward-thinking, rational, and allergic to being told what is normal.',
      "It's in your eighth house, meaning you rebel against outdated ideas of darkness, taboo, rebirth, sexuality, and transformation — and you are not quiet about it.",
    ],
    similar: [{ handle: '@maraellison33' }, { name: 'Rowan Voss' }],
    art: 'garlic',
    receipts: "09°26′ · EIGHTH HOUSE · PLACIDUS",
  },
  {
    key: 'neptune:aquarius:house7',
    title: 'Neptune in Aquarius',
    paras: [
      'Neptune stays in each sign for around fourteen years, meaning it shapes a generation more than a person. It rules dreams, imagination, and the subconscious. Your Neptune is in Aquarius, meaning your generation finds inspiration through rational analysis and the pursuit of knowledge.',
      "It's in your seventh house, meaning this shows up in your one-on-ones — you hold near-unrealistic ideals of intimacy and long-term partnership, and you keep testing reality against them.",
    ],
    receipts: "28°30′ · SEVENTH HOUSE · PLACIDUS",
  },
  {
    key: 'pluto:sagittarius:house6',
    title: 'Pluto in Sagittarius',
    paras: [
      "Pluto stays in each sign for up to thirty years, meaning it rules a generation more than a person. It rules power, intensity, obsession, and control. Your Pluto is in Sagittarius, meaning your generation's psyche is comparatively positive, free-spirited, curious, optimistic, forward-looking, independent, and confident.",
      "It's in your sixth house, meaning you personally are transforming outdated approaches to day-to-day experiences of work, routines, and bodily health.",
    ],
    similar: [{ handle: '@maraellison33' }, { name: 'Rowan Voss' }],
    art: 'meteorite',
    receipts: "09°01′ · SIXTH HOUSE · PLACIDUS",
  },
];

/* ---------------- transits (Home) ---------------- */

export interface TransitWindow {
  id: string;
  range: string;
  title: string;
  paras: string[];
  orbit: { transiting: Body; natal: Body; type: string };
}

export const DAY = {
  dateLabel: 'TUESDAY, OCTOBER 28',
  moonLine: 'Moon in Gemini · waxing gibbous',
  sketchTitle: 'Say the thing you\'ve been rehearsing',
  sketchParas: [
    "Mars trines your Mercury today and the Gemini moon makes words cheap — but yours will land. You've run the sentence enough times in your head; it survives outside of it too.",
    'Send the text before noon, when the moon goes void-of-course and everyone, including you, loses their nerve.',
  ],
  retrograde: {
    label: 'SATURN RETROGRADE',
    until: 'UNTIL NOVEMBER 28',
    body: 'Saturn retrograde is a paperwork audit of your boundaries. Commitments you made out of politeness come back for a real signature, or a real goodbye. In your eleventh house, this is mostly about who you let sit at the table. Renegotiate gently. You are allowed to change the terms.',
  },
};

export const TRANSITS: TransitWindow[] = [
  {
    id: 'pluto-trine-moon',
    range: 'OCTOBER 23 — NOVEMBER 7',
    title: 'Pluto trine natal Moon',
    paras: [
      'You have a desire to expand your subconscious. There will be a chance opportunity that affects the fields of your natural talents. You may be a little disconnected from reality right now. Most new ways of living are uncomfortable. Do it anyway.',
    ],
    orbit: { transiting: 'pluto', natal: 'moon', type: 'TRINE' },
  },
  {
    id: 'saturn-sextile-sun',
    range: 'NOVEMBER 2 — NOVEMBER 14',
    title: 'Saturn sextile natal Sun',
    paras: [
      'A quiet green light. Structures you have been building since spring get one load-bearing brick placed correctly, and suddenly the thing stands up on its own. Ask the older person for the meeting. Saturn rewards the boring email.',
    ],
    orbit: { transiting: 'saturn', natal: 'sun', type: 'SEXTILE' },
  },
  {
    id: 'mars-opposite-mars',
    range: 'NOVEMBER 9 — NOVEMBER 20',
    title: 'Mars opposite natal Mars',
    paras: [
      'Everything with a pulse gets louder, including you. Friction is data: the people who block you now are showing you where the wall actually is. Spend the aggression in the gym, in the drafts folder, on the long walk — not in the group chat.',
    ],
    orbit: { transiting: 'mars', natal: 'mars', type: 'OPPOSITION' },
  },
];

/* ---------------- friends ---------------- */

export interface Friend {
  id: string;
  name: string;
  handle: string;
  bigThree: { sun: Sign; moon: Sign; rising: Sign };
  line: string;
  shared: string[];
  topAspect: string;
  similarity: number;
  analysis: { heading: string; paras: string[]; receipts?: string }[];
}

export const FRIENDS: Friend[] = [
  {
    id: 'mara',
    name: 'Mara Ellison',
    handle: '@maraellison33',
    bigThree: { sun: 'Scorpio', moon: 'Pisces', rising: 'Leo' },
    line: 'Venus squares her Jupiter — send her flowers, not advice.',
    shared: ['Pluto in Sagittarius', 'Uranus in Aquarius', 'Sun in Scorpio'],
    topAspect: 'VENUS ☍ JUPITER · ORB 1.8°',
    similarity: 84,
    analysis: [
      {
        heading: 'Attraction',
        paras: [
          "Your Venus trine her Moon is the easy part: affection moves between you two without translation, water recognizing water. She finds your intensity clarifying rather than alarming, which is rare — most people meet a Scorpio sun and brace for impact.",
          'The pull is real, but it is tidal. When it recedes, neither of you says anything, and the silence gets interpreted by the two most paranoid interpreters in the zodiac. Name the weather out loud.',
        ],
        receipts: 'VENUS △ MOON · ORB 2.1° · SUN ☌ SUN · ORB 0.2°',
      },
      {
        heading: 'Communication',
        paras: [
          'Your Mercury in Scorpio asks the second question; her Pisces moon answers in weather, not words. This works when you accept that she tells the truth sideways, in songs and screenshots, and it fails when you demand a deposition.',
          'Text her after 9pm. Her moon opens up when the day stops demanding performance, and your twelfth-house sun does its best thinking in the dark anyway.',
        ],
      },
      {
        heading: 'Friction',
        paras: [
          "Her Leo rising needs an audience; your twelfth-house sun hides in the bathroom at parties. Neither of you is wrong — but at a wedding you are orbiting different suns. The fix is not compromise, it is scheduling: let her have the dance floor, and meet her after.",
          'Mars opposite Mars between your charts means the fights you do have are short and loud and weirdly clarifying. Do not let either of you sulk for three days first.',
        ],
        receipts: 'MARS ☍ MARS · ORB 0.4° · MOON □ MARS · ORB 2.2°',
      },
      {
        heading: 'Long-term',
        paras: [
          "Pluto on Pluto: you are the same generation's psyche, negotiating the same obsession with authenticity from two different houses. That shared assignment is the foundation — you are both becoming someone new in the same years, and you get to watch.",
          "Saturn's verdict: this friendship survives its first real crisis stronger. The eleventh-house question is whether you build something shared — a project, an apartment, a tradition — or only witness each other. Build the thing.",
        ],
      },
    ],
  },
  {
    id: 'rowan',
    name: 'Rowan Voss',
    handle: '@rowanvoss',
    bigThree: { sun: 'Taurus', moon: 'Gemini', rising: 'Sagittarius' },
    line: 'First Saturn opposition. Buy him dinner, let him vent.',
    shared: ['Saturn in Taurus', 'Pluto in Sagittarius', 'Uranus in Aquarius'],
    topAspect: 'SATURN ☌ SATURN · ORB 0.1°',
    similarity: 71,
    analysis: [
      {
        heading: 'Attraction',
        paras: [
          "Saturn on Saturn — you were built under the same sky's discipline, and it shows as mutual respect before it shows as warmth. He trusts you because you both know the price of things.",
          'Your Venus in Cancer cooks; his Taurus sun eats. This is not a metaphor. Feed him and the friendship is permanent.',
        ],
        receipts: 'SATURN ☌ SATURN · ORB 0.1° · VENUS △ MOON · ORB 3.4°',
      },
      {
        heading: 'Communication',
        paras: [
          'His Gemini moon narrates everything; your Scorpio Mercury extracts everything. Together you produce long walks with no destination and at least one unresolvable debate about money.',
          'He will never ask directly for reassurance. Give it unprompted, once, and it compounds for a decade.',
        ],
      },
      {
        heading: 'Friction',
        paras: [
          "His Sagittarius rising promises things at altitude; your Mars in Cancer resents being the landing gear. The pattern: he says yes for both of you, you absorb the logistics, then the tide goes out. Invoice him kindly, early, and often.",
        ],
      },
      {
        heading: 'Long-term',
        paras: [
          "Saturn friendships are load-bearing. He is the person who shows up with a van when the lease ends, no speech attached. Keep him past the seasons when convenience would have you drift; the eleventh house says this one is infrastructure.",
        ],
      },
    ],
  },
  {
    id: 'freya',
    name: 'Freya Lindholm',
    handle: '@freyalindholm',
    bigThree: { sun: 'Scorpio', moon: 'Virgo', rising: 'Leo' },
    line: "Moon in her first house today — she's reading the room harder than usual.",
    shared: ['Sun in Scorpio', 'Pluto in Sagittarius'],
    topAspect: 'MERCURY ☌ MERCURY · ORB 0.2°',
    similarity: 76,
    analysis: [
      {
        heading: 'Attraction',
        paras: [
          'Sun on sun: two Scorpios in a room is either a bunker or a reactor, and usually both. You recognize the machinery in each other instantly — the surveillance, the loyalty, the polite version of the truth you keep in reserve.',
        ],
        receipts: 'SUN ☌ SUN · ORB 1.1°',
      },
      {
        heading: 'Communication',
        paras: [
          "Mercury on Mercury is the rarest kind of fluency: you edit each other's texts before sending, finish the analysis in one hop, and share a private vocabulary the group chat cannot parse.",
        ],
      },
      {
        heading: 'Friction',
        paras: [
          'Two fixed-water suns: nobody apologizes first, ever. The standoff record is currently eleven days. Break it with logistics — "are we still on for Thursday" — and let the warmth refill behind the practical sentence.',
        ],
      },
      {
        heading: 'Long-term',
        paras: [
          "She is a keeper of your receipts — the person who remembers what you said you'd do in 2021. Terrifying and necessary. The twelfth-house sun needs exactly one friend like this.",
        ],
      },
    ],
  },
  {
    id: 'theo',
    name: 'Theo Marchetti',
    handle: '@theomarchetti',
    bigThree: { sun: 'Pisces', moon: 'Leo', rising: 'Libra' },
    line: "Jupiter crosses his descendant — he'll be overspending on someone.",
    shared: ['Uranus in Aquarius', 'Neptune in Aquarius', 'Pluto in Sagittarius'],
    topAspect: 'VENUS △ ASC · ORB 1.2°',
    similarity: 58,
    analysis: [
      {
        heading: 'Attraction',
        paras: [
          'Your Venus trine his ascendant: he experiences you as a warm room. Around you, the Libra rising stops performing and the Leo moon stops auditioning, and he gets to find out what he actually thinks.',
        ],
        receipts: 'VENUS △ ASC · ORB 1.2°',
      },
      {
        heading: 'Communication',
        paras: [
          "He processes by talking; you process by disappearing. Give him the monologue and he'll give you the ending of the movie you didn't know you were in.",
        ],
      },
      {
        heading: 'Friction',
        paras: [
          'Pisces sun with a Leo moon apologizes beautifully and changes nothing. Your Scorpio Mercury keeps the receipts; use them for patterns, never for ambushes.',
        ],
      },
      {
        heading: 'Long-term',
        paras: [
          'He is the friend who makes the sky feel like a party again when Saturn gets too heavy. Keep one standing plan a month. It matters more than it looks.',
        ],
      },
    ],
  },
  {
    id: 'cass',
    name: 'Cass Ibarra',
    handle: '@cassibarra',
    bigThree: { sun: 'Cancer', moon: 'Virgo', rising: 'Cancer' },
    line: 'Moon returns tonight. She will cancel plans. Let her.',
    shared: ['Venus in Cancer', 'Mars in Cancer'],
    topAspect: 'MOON ☌ ASC · ORB 0.6°',
    similarity: 66,
    analysis: [
      {
        heading: 'Attraction',
        paras: [
          'Her Cancer moon sits on your ascendant: she reads you accurately from across a room, which is either the safest feeling in the world or the most exposed. With her it turns out to be safe.',
        ],
        receipts: 'MOON ☌ ASC · ORB 0.6°',
      },
      {
        heading: 'Communication',
        paras: [
          'Two water moons text in caretaking: "did you eat" is a love letter. Neither of you says the direct thing until the very end of the conversation, and you both know to wait for it.',
        ],
      },
      {
        heading: 'Friction',
        paras: [
          "Cancer moon on Cancer rising: combined, you can sulk a whole weekend into fog. Someone has to say the feeling in a sentence. It should probably be the one who wasn't wrong.",
        ],
      },
      {
        heading: 'Long-term',
        paras: [
          'Shared Venus and Mars in Cancer: you want the same cozy, defended life. Friends who could co-author a kitchen. Do it before the real estate market makes the decision for you.',
        ],
      },
    ],
  },
];

/* ---------------- void ---------------- */

export interface VoidPost {
  id: string;
  body: string;
  astroTag?: string;
  echoed: boolean;
  mine?: boolean;
  ageH: number;     // hours old, drives decay opacity
}

export const VOID_POSTS: VoidPost[] = [
  { id: 'v1', body: 'told my boss the deadline was "ambitious" and then cried in the parking garage. mercury is doing something. i know it.', astroTag: 'mercury', echoed: false, ageH: 2 },
  { id: 'v2', body: 'i keep his contact saved as "do not text" which is honestly more commitment than most relationships', echoed: true, ageH: 5 },
  { id: 'v3', body: 'the group chat made a shared doc titled "2026 recovery plan". i am not recovering. i am transforming. (pluto)', astroTag: 'pluto', echoed: false, ageH: 9 },
  { id: 'v4', body: "does anyone else feel like they're waiting for their real life to start, or is that just my twelfth house sun talking", echoed: false, ageH: 14 },
  { id: 'v5', body: 'she said "you\'re a lot" like it was a bad thing. the AUDACITY. i am a lot. mars in cancer will not let me say this to her face so it goes here', astroTag: 'mars', echoed: false, ageH: 22 },
  { id: 'v6', body: "i want to move to a coastal town and become a person who walks. same job though. that's the joke i guess", echoed: false, ageH: 31 },
  { id: 'v7', body: 'not to be dramatic but if one more person tells me to "just relax" i will simply combust. saturn is sitting on me personally', astroTag: 'saturn', echoed: false, ageH: 38 },
  { id: 'v8', body: "weirdly peaceful in here tonight. the moon is doing its thing. maybe we're all going to be fine, eventually, in some direction", echoed: false, ageH: 44 },
];

export const VOID_RULES = [
  'YOU ARE ANONYMOUS. ALWAYS.',
  'NOTHING HERE LASTS. POSTS FADE IN 48 HOURS.',
  'NO LIKES. ONLY ECHOES.',
  'WHAT HAPPENS IN THE VOID STAYS IN THE VOID.',
];

/* ---------------- shop ---------------- */

export interface Product {
  id: string;
  name: string;
  kind: 'prints' | 'rituals' | 'objects' | 'books';
  priceCents: number;
  artKey: string;
  blurb: string;
  specs: string[];
  personalizable?: boolean;
  variant?: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'p1', name: 'Your Natal Chart, Screen-Printed', kind: 'prints', priceCents: 8500,
    artKey: 'moon', personalizable: true,
    blurb: 'Your actual wheel — houses, glyphs, aspect lines, the whole argument — pulled by hand in white ink on black French paper. The most personal thing in the shop, because it is only yours.',
    specs: ['18 × 24 IN · FRENCH PAPER CO.', 'WHITE INK ON BLACK', 'SHIPS ROLLED IN A TUBE'],
    variant: ['18 × 24 in', '24 × 36 in'],
  },
  {
    id: 'p2', name: 'Pluto in Sagittarius, Sixth House', kind: 'prints', priceCents: 3800,
    artKey: 'meteorite',
    blurb: 'A placement print for the part of your chart that is transforming your work, your routines, and your body\'s mind. Hang it where you do the dishes and let it watch.',
    specs: ['11 × 17 IN', 'EDITION OF 500', 'MATTE BLACK INK'],
  },
  {
    id: 'p3', name: 'The Void Candle', kind: 'rituals', priceCents: 2800,
    artKey: 'candle',
    blurb: 'Burns for exactly forty-eight hours, like a post in the Void. Light it when you need the feeling to have somewhere to go. No scent. The dark is the scent.',
    specs: ['48 HR BURN', 'SOY WAX · COTTON WICK', 'GLASS, REUSABLE'],
  },
  {
    id: 'p4', name: 'Transit Journal, Undated', kind: 'books', priceCents: 3200,
    artKey: 'stone',
    blurb: 'An undated journal for people who track their weather. Morning pages on the left, the sky\'s paperwork on the right. Saturn approves of this product specifically.',
    specs: ['160 PAGES · DOT GRID', 'LIES FLAT', 'BLACK, OBVIOUSLY'],
  },
  {
    id: 'p5', name: 'Orchid Incense Holder, Zinc', kind: 'objects', priceCents: 2400,
    artKey: 'orchid',
    blurb: 'Die-cast zinc, heavier than it looks, like most water signs. Holds one stick at the exact angle of a waxing gibbous. Accessories not included; ash is.',
    specs: ['DIE-CAST ZINC', '90 G', 'DESIGNED IN-HOUSE'],
  },
  {
    id: 'p6', name: 'The Sky Workbook', kind: 'books', priceCents: 4200,
    artKey: 'hand',
    blurb: 'Learn your own chart the way we\'d teach it: no borrowed personality, one exercise per placement, and permission to disagree with us in the margins.',
    specs: ['128 PAGES', 'WORKS FOR ANY CHART', 'INCLUDES BLANK WHEELS'],
  },
];

/* ---------------- saved (You → Saved) ---------------- */

export const SAVED_ITEMS = [
  { id: 's1', kind: 'reading' as const, title: 'Pluto trine natal Moon', meta: 'TRANSIT · ENDS NOV 7' },
  { id: 's2', kind: 'reading' as const, title: 'Venus in Cancer', meta: 'PLACEMENT · FIRST HOUSE' },
  { id: 's3', kind: 'friend' as const, title: 'Mara Ellison', meta: '84% SKY SHARED · @maraellison33' },
  { id: 's4', kind: 'product' as const, title: 'The Void Candle', meta: 'SHOP · $28' },
];
