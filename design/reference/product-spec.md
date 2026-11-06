# our-sky — Product Spec

**Version:** 0.3 (refined) · **Status:** Draft for review · **Owner:** you + me
**Companion doc:** [`tech-spec.md`](./tech-spec.md)

---

## 1. Vision

**our-sky is a social astrology app for people who process life through the sky.** It computes your full natal chart from birth date, time, and place — then turns every placement into editorial, slightly melancholy, occasionally savage writing you actually want to read. Unlike magazine horoscopes that flatten you to a sun sign, our-sky reads the whole sky, and unlike astrology apps that are a lonely experience, our-sky makes the sky a **social space**: you see which friends share your placements, how your charts collide, and what the transits are doing to both of you.

**Positioning statement:** *Co-Star's brutalist soul + a real social layer + one genuinely new idea (the Void).*

**The one-liner for the App Store:** "Your birth chart, your friends' charts, and a black hole to scream into."

### 1.1 Design north stars

1. **Editorial, not mystical kitsch.** No purple gradients, no sparkle emoji, no "✨ blessed ✨". Pure black, grainy black-and-white collage art, serif headlines, typewriter mono UI. It should feel like a zine printed at midnight.
2. **Specificity over comfort.** Readings name real mechanics ("It's in your sixth house, meaning you personally are transforming outdated approaches to work, routines, and bodily health"). Vague flattery is forbidden in the voice guidelines.
3. **The sky is social by default.** Every placement card ends with a social hook — "Similar to @maraellison33 and Rowan Voss" — turning private meaning into shared recognition.
4. **One awe moment per session.** A wheel that spins, a card that arrives at the right second, a post dissolving into the Void. Daily retention is won on feeling, not features.

### 1.2 What we are NOT building

- No fortune-telling promises, no predictive claims about health/money/love outcomes ("Saturn says you'll get married in June" is banned).
- No swipe-feed social network. The social graph exists to contextualize *your* chart, not to farm engagement.
- No AI chatbot persona. The app speaks in second person, never role-plays a guru.

---

## 2. Why now, and why this wins

Astrology is a multi-billion-dollar market growing with Gen Z spirituality trends; Co-Star proved 20M+ people will hand over exact birth data for personalized readings, and The Pattern proved subscription content monetizes. But the category has three visible gaps:

1. **Astrology is inherently social, and existing apps treat it as private.** People already screenshot their Co-Star readings into group chats. our-sky makes the group chat native: shared placements, chart comparison, and friend transits are first-class objects.
2. **Nobody owns the "anonymous cosmic confession" space.** Co-Star's "Notes to the Universe" was killed; anonymous spiritual feeds are fragmented. The Void (§5.3) is our differentiated hook and our organic-growth engine ("screamed into the void" is a native Gen Z idiom).
3. **Content quality is the moat.** Everyone can compute a chart; almost nobody can *write*. Our content pipeline pairs a real editorial voice with LLM-assisted scale under strict voice constraints, so every placement reads like it was written by one very sharp human.

---

## 3. Who it's for

| Persona | Snapshot | What our-sky gives them |
|---|---|---|
| **The Chart-Known Gen Z ("Mara", 23)** | Already knows her big three; posts screenshots in the group chat; checks Co-Star with morning coffee | Deeper cards with house placements + who shares them; the Void for the feelings she won't post on main |
| **The Curious Newcomer ("Rowan", 27)** | Knows sun sign only; intimidated by jargon | Onboarding that teaches (sun/moon/rising reveal); every term tappable with plain-language explainers |
| **The Astro Nerd ("Ren", 31)** | Reads transit calendars; owns an ephemeris; sceptical of sloppy apps | Correct Placidus chart, real aspect data, transit timing windows ("OCT 23 — NOV 7"), shareable wheel |
| **The Social Stargazer ("June", 25)** | Uses astrology as friendship glue ("you're a Taurus, that explains it") | Friends tab, similarity badges, relationship analysis, "your friend is having a Saturn day" nudges |

**Primary:** Personas 1 and 4 (they drive DAU and invites). **Secondary:** 2 (converted by onboarding awe) and 3 (converted by correctness — they become our loudest advocates or harshest critics).

---

## 4. Information architecture

```
ONBOARDING (once)          5-TAB SHELL (persistent bottom nav)
┌─────────────────┐        ┌──────────────────────────────────────────┐
│ 1. Name          │        │ HOME      today's sky: day sketch,       │
│ 2. Birth date    │        │           transit windows, friend sky    │
│ 3. Birth time    │        │ FRIENDS   chart list, similarity,        │
│ 4. Birth place   │        │           relationship analysis          │
│ 5. "Your sky"    │        │ VOID      anonymous ephemeral feed       │
│    reveal        │        │ SHOP      prints / rituals / merch       │
└─────────────────┘        │ YOU       [Chart] reading cards           │
                            │           [Saved] bookmarked cards       │
                            │           [Settings] account & birth data│
                            └──────────────────────────────────────────┘
```

Nav order is intentional: **HOME → FRIENDS → VOID → SHOP → YOU**. The self is last (you arrive knowing yourself), the Void sits at the center — the mystical hinge of the app. Labels are always uppercase mono.

---

## 5. Screen specifications

### 5.0 Onboarding — "Cast your chart"

**Goal:** convert a download into a cast chart within 90 seconds, and teach while doing it.

- **Step 1 — Name.** Single input, mono label "WHAT DO WE CALL YOU". Optional handle auto-suggested (@firstname + digits), editable.
- **Step 2 — Birth date.** Wheel-style date picker (day / month / year). Copy teaches already: "The sun was here on this day."
- **Step 3 — Birth time.** Time wheel + explicit "I don't know my birth time" escape hatch → we default to 12:00 noon and mark chart as "birth time unknown" (rising/houses shown with a dashed "approximate" tag — honesty is a feature).
- **Step 4 — Birth place.** City autocomplete (geo dataset); map pin confirmation. Telemetry-free: we store lat/lng + city name only.
- **Step 5 — Reveal ("Your sky").** Full-screen sequence: black → grainy art flash → wheel spins and draws itself with aspect lines → serif headline "You are a **Scorpio sun, Aries moon, Cancer rising**" → three-line teaser for each → CTA "READ YOUR CHART".
- Progress is saving at every step (resume if killed). All steps skippable EXCEPT birth date.
- **shadcn mapping:** Input, Button, Popover+Calendar for date fallback, Command-style place search, Dialog for the "why do we need this?" privacy explainer.

### 5.1 HOME — "Today's sky"

**Goal:** the 30-second daily ritual; the reason to open at 8am and 11pm.

- **Day header.** Mono date "TUESDAY, OCTOBER 28", plus moon phase glyph + "Moon in Gemini, waxing gibbous" line. The moon is the most-checkable astro fact; getting it visibly right every day builds trust.
- **Day sketch card.** 2–4 sentences synthesizing today's dominant transit *for you personally* ("Mars trines your Mercury: say the thing you've been rehearsing"). Serif headline + body, same card anatomy as all readings.
- **Transit windows.** The web reference's "OCTOBER 23 — NOVEMBER 7 · Pluto trine natal Moon" card becomes a list: date-range mono label, serif aspect title, body, and a tiny orbit diagram (dashed orbit + glyph pair). Tapping opens the full reading.
- **Friend sky strip.** Horizontal cards: friend avatar, big-three glyphs, one line of *their* day ("Rowan's Saturn return is 14 months away" / "Mara's Venus is being squared — send her flowers"). Tapping jumps to the friendship view.
- **Retrograde banner.** If any retrograde is active: thin bordered strip "MERCURY RETROGRADE · UNTIL NOV 7 · WHAT THIS MEANS FOR YOU" (expandable). Toned down — one strip, no doom.
- Empty-state (no friends yet): the strip becomes "The sky is better shared" + invite button.
- **shadcn mapping:** ScrollArea, Card variants, Badge for windows, Accordion for retrograde explainer, Avatar.

### 5.2 FRIENDS — "Better together"

**Goal:** make the social graph feel like a constellation, not a contacts list.

- **Friends list.** Rows exactly like the web reference: name, mono glyphs "☉ Scorpio ↑ Virgo ↙ Leo", arrow. Row tap → **friend detail**.
- **Friend detail.** Their wheel beside yours (toggle overlay: "SEE TOGETHER"), their reading cards, and **Similarity panel**: shared placements ("You both have Pluto in Sagittarius — you're the same generation, obviously"), aspects between charts ("Your Venus trine their Moon: easy affection"), and the classic "what to expect when texting them" summary.
- **Relationship analysis.** The full synastry report (enter from friend detail or from a YOU-tab teaser, as in the reference app's "YOUR RELATIONSHIP ANALYSIS →"). Sections: Attraction, Communication, Friction, Long-term. Each section = serif heading + 2 paragraphs + aspect receipts (small mono footnotes like "VENUS △ MOON · ORB 2.1°"). Paywalled beyond section 1 (see §8).
- **Add friends.** Handle search + contacts invite + share link. Request model: follow → they appear in your sky when accepted (symmetrical by default; asymmetry later).
- **Invite mechanics.** The similarity hook IS the invite: "3 of your friends share your moon sign. See who." → send invite → unlock full similarity panel when they join.
- **shadcn mapping:** Tabs (chart/overlay toggle), Sheet (relationship analysis on mobile), custom orbs for similarity score, Dialog for invite.

### 5.3 VOID — the anonymous cosmos

**Goal:** the differentiated daily habit; the emotional release valve; the organic share loop. This tab is ours — no reference product nails it.

**Concept.** The Void is a collective, anonymous, *ephemeral* feed. You post a thought, a confession, a grief, a crush — no name, no likes, no follower counts. Posts appear as small white text blocks drifting in a black field with grainy cosmic art. Every post **decays**: it visibly fades over ~48h and then collapses into a tiny white dot that joins the Void's "starfield" (a living archive of everything ever posted, shown as a night sky you can explore — dots are anonymous forever, text is gone).

**Rules of the Void (shown as a mono manifesto on first visit):**
1. YOU ARE ANONYMOUS. ALWAYS.
2. NOTHING HERE LASTS. POSTS FADE IN 48 HOURS.
3. NO LIKES. ONLY ECHOES. (an "Echo" = anonymous resonance; a post that receives echoes briefly brightens and drifts upward — no counts are shown to keep it non-competitive; you see "this echoed with someone" max once per post)
4. WHAT HAPPENS IN THE VOID STAYS IN THE VOID. (no sharing screenshots of others' posts; share-your-own renders as a beautiful black card with no username)

**Screen anatomy:**
- **Composer.** Always docked at the bottom above the nav (collapsed: "SPEAK INTO THE VOID"). Expand = full black sheet, serif placeholder "What's in your orbit tonight?", optional **astro-tag**: the app suggests one based on your current strongest transit ("tag this as Mars?" — one tap), or the user picks none. 500 chars max. Posting animation: text collapses into a dot and flies into the field.
- **Feed.** Posts ordered by "drift" — a blend of recency + echoes, never viral (no algorithmic cliffhangers). Each post: body text only (no username, no timestamp — age shown as decay state: solid → translucent → "fading" → dot). Long-press to Echo (with haptic), tap post to expand + "echoed with someone" state if applicable.
- **Your posts.** Indicated by a faint outline; you can collapse your own post into a dot early ("take it back").
- **Moderation.** AI filter at post-time (self-harm/hate → soft block + care resources card, styled gently, mono text, no moralizing); community report → post dims pending review. No public replies ever (no reply chains, no dogpiles).
- **Why it works:** it's the group-chat screenshot energy of astrology (my Mercury is retrograde and so is my brain) with zero social cost. It also generates anonymous content at near-zero authoring cost.
- **shadcn mapping:** Textarea, Drawer (composer), Sonner toast ("released into the void"), custom starfield component for the archive, AlertDialog for report flow.

### 5.4 SHOP — "Objects for the sky"

**Goal:** revenue + brand extension; also a content surface (objects carry the same voice).

- **Layout.** Two-column grid of objects on black; serif names, mono prices. Categories via mono filter chips: PRINTS / RITUALS / OBJECTS / BOOKS.
- **Hero objects (launch catalog):** natal-chart art print (YOUR actual wheel, screen-printed — the killer SKU, personalized), planet-placement prints ("PLUTO IN SAGITTARIUS · SIXTH HOUSE"), the Void candle ("burns for exactly 48 hours"), a tarot-free "transit journal", zinc incense holder. Prices $18–$120.
- **Product detail.** Full-bleed grainy art, serif description in the house voice, mono specs (size/paper/materials), size/variant select, "ADD TO CART".
- **Cart & checkout.** Cart as bottom Sheet; checkout as a screen (mock in prototype; Stripe later). Personalized prints require chart → deep link to saved chart data.
- **shadcn mapping:** Carousel (hero), Badge (sale/new), Select (variants), Sheet (cart), Button, Separator, Input (promo).

### 5.5 YOU — "Your chart"

Sub-tabs exactly like the reference: **Chart / Saved / Settings** (mono, underline for active).

- **Chart (default).** Vertically scrolling **reading cards**, one per placement, in canonical order (Sun → Moon → Mercury → Venus → Mars → Jupiter → Saturn → Uranus → Neptune → Pluto → Rising → MC): serif title ("Pluto in Sagittarius"), body paragraphs (sign meaning → house meaning), grainy B&W art interspersed between cards (meteorite, skull, dove, garlic — surreal, not literal), and the social footer "ⓘ Similar to @maraellison33 and Rowan Voss" where similarity data exists. Top of the scroll: your wheel + big-three summary row. Tapping a card → full-screen detail with more depth + "WHY THIS READING" (shows the astrological mechanics: degrees, orb — for the nerds).
- **Saved.** Bookmarked cards (from Home, Friends, Void-adjacent content) as compact rows; swipe to unsave. Empty state: "Nothing kept yet. The sky is patient."
- **Settings.** Grouped mono sections: BIRTH DATA (edit → recasts chart with confirm dialog "your readings will be recalculated"), NOTIFICATIONS (Switch list: daily sky, transit windows, friend sky, void echoes), ACCOUNT (handle, email, delete account), APPEARANCE (theme: VOID BLACK / PAPER — light mode exists but black is default), ABOUT (manifesto, credits). Destructive actions use AlertDialog.
- **shadcn mapping:** Tabs, Switch, AlertDialog, Input, Select, Separator, ScrollArea.

---

## 6. Content model — the reading card

The card is the atom of the entire product (Home, You, Friend detail all reuse it):

```
┌─────────────────────────────┐
│ Pluto in Sagittarius        │  ← serif, 28–32px, sentence case
│                             │
│ [sign paragraph: what the   │  ← sans body, 16px/1.6, includes the
│ planet rules + what it means │     "generation vs person" mechanics
│ in this sign]               │
│                             │
│ [house paragraph: "It's in  │  ← the personal, specific layer
│ your sixth house, meaning…] │
│                             │
│ ⓘ Similar to @mara and Rowan │  ← mono footer, underlined links,
└─────────────────────────────┘     only when similarity data exists
```

**Voice guidelines (enforced in the content pipeline):**
1. Second person, declarative, no hedging ("you may perhaps feel sometimes" → banned).
2. One mechanical fact per paragraph minimum ("Pluto stays in each sign for up to thirty years").
3. Prescriptive twist at the end of house paragraphs ("Do it anyway." / "You already know which call this is.").
4. Savage is allowed; cruel is not. Never pathologize; never diagnose.
5. Banned words: vibes, energy (as filler), manifest, universe has your back, blessing, journey.
6. Every reading must survive the screenshot test: would someone send this to a friend with "omg"?

**Coverage required for launch:** 10 planets × 12 signs × 12 houses ≈ 1,440 sign+house pairs (template-composed, see tech spec §5), plus ~60 major transits × personalized house flavor, plus synastry × relationship-section bank.

---

## 7. Social mechanics details

- **Similarity.** Computed on cast: shared sign placements (weighted: personal planets 3, social 2, generational 0.5), same house emphasis, tightest cross-chart aspects. Powers: reading-card footers, friend ranking, invite hooks.
- **Notifications that feel like a friend, not a marketer:** "Pluto trines your moon until Nov 7 — you're allowed to want things." Frequency cap: max 1 push/day, quiet hours respected.
- **Friend sky events** are computed, not written: "Mara just entered a Pluto window" uses the same transit engine as Home.

## 8. Monetization

1. **SHOP** (immediate): prints + objects; personalized natal print is the hero SKU and the best organic marketing object we could ask for.
2. **our-sky+ (month 2+, $6.99/mo or $39/yr):** full relationship analyses, advanced transit windows ("your next three Saturn-hard weeks, dated"), yearly sky map, unlimited Void post archives (free users' dots lose text after decay; plus keeps private text), chart overlay tool.
3. **Not monetized, ever:** the Void. Keeping it pure is the brand.

## 9. Success metrics

- **Activation:** % of installs who cast a chart (target 65%+); time-to-first-chart < 3 min.
- **Habit:** D7 retention ≥ 25%; Home day-sketch open rate ≥ 55% of DAU.
- **Social:** ≥ 1.4 friends connected per activated user by day 14; % of reading-card taps on "Similar to" links ≥ 8%.
- **The Void:** % DAU who post or Echo ≥ 18%; echo-per-post median ≥ 1 (proves resonance without vanity).
- **Revenue:** personalized print attach ≥ 2% of MAU; plus conversion ≥ 4% of D30 users.

## 10. Roadmap

- **M0 — Mockups (this build).** Full interactive prototype: all 5 tabs + onboarding + relationship analysis, demo data, real design system. Validating feel and voice.
- **M1 — Private alpha (4–6 wks).** Real chart engine + readings bank for personal planets; Home + You + Friends; TestFlight.
- **M2 — Public beta (8–12 wks).** Void v1 with moderation, similarity invites, notifications, SHOP with 8 SKUs (digital + print-on-demand).
- **M3 — Launch (14–16 wks).** Relationship analysis paywall, our-sky+, referral ("send a friend their shared placement card").
- **Post-launch bets:** Widgets (day sketch + moon phase), Apple Watch complication ("the sky right now"), group "skies" (group-chat-as-constellation), transit calendar export.

## 11. Risks & open questions

| Risk / question | Mitigation |
|---|---|
| Birth-time privacy is sensitive data | Store lat/lng only; encrypt at rest; no data sale, ever; visible privacy manifesto at onboarding (§5.0) |
| VOID abuse (self-harm content) | AI pre-filter + care resources + human review; report flow; no replies = no dogpiles |
| Astrological accuracy credibility | Named house system (Placidus) on chart screen; "birth time unknown" honesty mode; nerd receipts on every reading |
| Content pipeline cost (1,440+ readings) | Template composition + LLM draft + editorial pass + cache-per-placement |
| Does the Void get lonely/empty at small scale? | Seed with computed cosmic facts pre-mixed into the drift ("The moon enters Gemini in 3 hours"); launch Void only when DAU > threshold |
| Differentiation vs Co-Star's brand gravity | We win on (a) native social graph, (b) the Void, (c) objects you can touch; never on feature parity with their app |

---

*Refined collaboratively from the reference screenshots (reading-card anatomy, IA, web wheel & friends patterns) — this document is the source of truth for what M0's mockups must prove.*

> **Privacy note:** All names, handles, emails, and birth details used anywhere in this product are fictional demo data invented for the mockups. No real persons are referenced.
