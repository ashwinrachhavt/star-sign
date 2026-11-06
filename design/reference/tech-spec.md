# our-sky — Tech Spec

**Version:** 0.3 · **Status:** Draft for review · **Companion:** [`product-spec.md`](./product-spec.md)

---

## 1. Stack (and why)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript 5** | One deployable for app + marketing site + API; RSC keeps reading-card pages SEO-friendly later |
| Styling | **Tailwind CSS 4** | Token-driven design system in CSS variables; zero runtime |
| UI kit | **shadcn/ui (New York)** + Lucide icons | Ownable components we restyle to the brutalist token set; drawer (vaul), toasts (sonner), carousel (embla) already in ecosystem |
| Motion | **framer-motion** | Wheel spin, card transitions, Void decay/drift animations |
| DB | **Prisma + SQLite** (dev) → Postgres (prod) | Chart/readings/social are relational; Prisma keeps the switch trivial |
| Auth | **NextAuth v4** (email magic link + Apple) | Birth data demands real accounts; magic link = least-friction secure default |
| State | **Zustand** (app UI state) + **TanStack Query** (server state) | Tiny client state for tab shell/cart; query cache for chart/readings |
| Astro engine | **astronomy-engine** (MIT, Moshier ephemeris, pure JS) | No WASM/native build pain; ±1 arc-minute accuracy, enough for sign/house/aspect work; runs in Node (server-only) |
| AI content | **z-ai-web-dev-sdk (server-side only)** | LLM draft generation inside strict voice templates; moderation for Void posts |

**Non-goals for M0:** real accounts, real ephemeris calls (mockup ships with one pre-computed demo chart), payments. The mockup is a *design-complete* vertical slice with production-shaped components.

---

## 2. System architecture

```
┌────────────────────────── Next.js app (single deployable) ─────────────────────────┐
│                                                                                     │
│  app/(marketing)        app/(app)                    app/api/*                      │
│  ├ page.tsx (site)      ├ onboarding/                ├ chart/cast        POST       │
│  └ download/            ├ home | friends | void      ├ readings/[id]    GET/POST    │
│                         ├ shop | you                 ├ transits/today   GET         │
│  components/our-sky/*   └ relationship/[friend]      ├ void/posts       GET/POST    │
│  ├ ReadingCard (atom)                                ├ void/echo        POST        │
│  ├ ChartWheel (SVG)      lib/                        ├ shop/checkout    POST        │
│  ├ ArtImage              ├ astro/ephemeris.ts        └ moderate/void    POST        │
│  └ …                     ├ astro/houses.ts (Placidus)                               │
│                          ├ astro/aspects.ts                                          │
│  prisma/schema.prisma    ├ content/compose.ts                                        │
│  (User, Chart,           └ similarity.ts                                             │
│   Reading, VoidPost…)                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
           │                                    │
     SQLite/Postgres                     z-ai SDK (server only)
     (data of record)                    (draft readings, void moderation)
```

**Key architectural rules**
1. **The astro engine never runs client-side.** All placements/houses/aspects are computed on the server at cast-time, stored as rows, and served as data. Client renders; it never recomputes.
2. **Readings are content, not generations at read-time.** `readings` table is a cache keyed by `placement-sign-house` (+ transit windows keyed by aspect). LLM drafting happens once per unique key at ingest/build; the app never pays LLM latency on a user path.
3. **The design system is code.** Every screen composes from `components/our-sky/*`; no screen-local typography or spacing.

---

## 3. Data model (Prisma, production-shaped)

```prisma
model User {
  id            String   @id @default(cuid())
  handle        String   @unique            // @maraellison33
  displayName   String
  email         String?  @unique
  birth         BirthData?
  chart         Chart?
  voidPosts     VoidPost[]
  savedItems    SavedItem[]
  friendsAsA    Friendship[] @relation("a")
  friendsAsB    Friendship[] @relation("b")
  createdAt     DateTime @default(now())
}

model BirthData {
  id          String  @id @default(cuid())
  userId      String  @unique
  date        String   // ISO "1998-11-20"
  time        String?  // "08:41" — null = time unknown
  timeUnknown Boolean  @default(false)
  city        String
  lat         Float
  lng         Float
  tz          String   // IANA zone at birth
}

model Chart {
  id          String   @id @default(cuid())
  userId      String   @unique
  houses      String   // JSON: [12 cusp longitudes], system: "placidus"
  points      String   // JSON: [{body:"sun", sign:"scorpio", deg:28.25, house:12, retro:false}, …]
  aspects     String   // JSON: [{a:"sun", b:"moon", type:"trine", orb:2.1}]
  bigThree    String   // JSON: {sun:"scorpio", moon:"aries", rising:"cancer"}
  castVersion String   // engine version for reproducibility
}

model Reading {
  id        String @id @default(cuid())
  kind      String // "placement" | "transit" | "synastry"
  key       String @unique // "pluto:sagittarius:house6" / "pluto-trine-moon"
  title     String
  body      String // JSON: paragraphs
  receipts  String?// JSON: mono footnotes {degrees, orb, window}
  voiceVer  String // voice-guideline version for re-audits
  updatedAt DateTime @updatedAt
}

model Friendship {
  id       String  @id @default(cuid())
  aId      String
  bId      String
  status   String  // "pending" | "active"
  similarity String? // JSON: {score, shared[], topAspects[]} — computed on accept
  @@unique([aId, bId])
}

model VoidPost {
  id        String   @id @default(cuid())
  authorId  String?  // null = pre-seeded cosmic fact; never exposed
  body      String   // ≤500 chars
  astroTag  String?  // "mars" | "venus" | null
  echoes    Int      @default(0)
  echoedMe  Boolean  @default(false) // viewer already echoed (per-request scope in prod)
  createdAt DateTime @default(now())
  expiresAt DateTime // createdAt + 48h → UI decay = f(now, expiresAt)
  status    String   @default("live") // "live" | "dimmed" (reported) | "removed"
}

model SavedItem {
  id       String @id @default(cuid())
  userId   String
  kind     String // "reading" | "transit" | "product"
  refId    String
  note     String?
  @@unique([userId, kind, refId])
}

model Product {
  id        String  @id
  name      String
  kind      String  // "print" | "ritual" | "object" | "book"
  priceCents Int
  personalizable Boolean @default(false) // natal wheel print
  artKey    String  // /art/*.png
  blurb     String  // serif description in house voice
  specs     String  // JSON mono spec lines
}
```

---

## 4. Astro computation (`lib/astro/*`, server-only)

1. **`ephemeris.ts`** — `astronomy-engine`: geocentric ecliptic longitudes for Sun…Pluto + lunar nodes + Lilith; retrograde via daily delta sampling. Moshier accuracy (±1′) is ample; we display degrees-minutes only.
2. **`houses.ts`** — Placidus cusps from (lat, lng, time). Fallbacks: polar-edge cases → Porphyry; `timeUnknown` → solar chart (noon) with `approximate` flags on houses/rising. **The UI names the system** ("PLACIDUS · APPROXIMATE") — nerd trust is a feature.
3. **`aspects.ts`** — conjunct/sextile/square/trine/oppose (+quincunx for synastry) with orbs: luminaries 8°, personal 6°, social 4°, generational 2°; applying vs separating noted for transits.
4. **`transits.ts`** — windows where transiting body crosses aspect to natal point; returns `{start, end, type}` used by Home cards ("OCTOBER 23 — NOVEMBER 7").
5. **`similarity.ts`** — weights: personal-planet shared sign ×3, social ×2, generational ×0.5, shared house emphasis ×1, top synastry aspect bonus ×2. Output: `{score 0–100, shared[], topAspects[]}` → drives card footers + friend ranking.

All functions are pure and unit-tested against known charts (e.g., the reference screenshot's placements) before alpha.

---

## 5. Content pipeline (voice is the moat)

```
placement key (e.g. pluto:sagittarius:house6)
   → 1. TEMPLATE COMPOSE:   planet-bank paragraph (mechanics)  +
        sign-bank paragraph (generation/persona) +
        house-bank paragraph (personal specificity)
   → 2. LLM DRAFT PASS (z-ai SDK, server): merges 3 blocks into 2 flowing
        paragraphs; prompt embeds the VOICE RULES + 10 gold-standard
        exemplars (the reference cards verbatim) + banned-word list
   → 3. EDITORIAL REVIEW QUEUE: human pass in a tiny admin UI; approve →
        frozen into `readings` cache
   → 4. AUDIT: lint for banned words, hedging, second-person drift
```

- **Cache-per-key:** 1,440 placement keys + ~60 transit aspects + synastry bank. At ~600 tokens/draft the full LLM cost of launch coverage is a few hundred dollars once, then free forever.
- **Personalization happens at render, not generation:** house numbers, degrees, and "Similar to @handle" footers are injected into approved templates, so approved content is never mutated by the LLM.
- **Void moderation:** post → server-side LLM classification (self-harm/hate/safe). Unsafe → soft-block + gentle care-resources card. Borderline → posts `dimmed` pending review. Logs retained, never trained on.

---

## 6. Design system tokens (implemented in this prototype)

```css
--bg: #050505;          /* void black — never pure #000 on OLED, cards sit on it */
--surface: #0B0B0B;
--line: #2A2A2A;        /* hairline card borders */
--ink: #F2F2F0;         /* primary text, warm white */
--ink-dim: #8A8A8A;     /* secondary, mono labels */
--accent: #E23636;      /* the ONLY red — heart, live dot, nothing else */
--serif: "Source Serif 4", Georgia, serif;   /* card titles, headlines */
--sans: "Inter", system-ui, sans-serif;      /* body */
--mono: "IBM Plex Mono", monospace;          /* nav, labels, receipts */
```

- **Card anatomy component** (`ReadingCard`): 1px `--line` border, square corners, 24px padding, no shadow ever.
- **Art direction:** grainy B&W photographic cutouts on black (`public/art/*.png`), always full-bleed-ish and asymmetric — never inside the bordered cards.
- **Type scale:** serif 30/38 titles · sans 15.5/26 body · mono 11px/–0.02em uppercase labels (+0.18em tracking for nav).
- **Motion:** 200–400ms ease-out only; wheel spin 1.2s; Void decay is continuous CSS/canvas animation.

---

## 7. API surface (App Router handlers)

| Route | Method | Purpose |
|---|---|---|
| `/api/chart/cast` | POST | Birth data → cast → store Chart; returns big-three + placements |
| `/api/readings/[key]` | GET | Approved reading from cache; 404 → editorial fallback template |
| `/api/transits/today` | GET | Personalized day sketch + open windows + retrogrades |
| `/api/friends` | GET/POST/DELETE | List, request, remove; similarity computed on accept |
| `/api/relationship/[friendId]` | GET | Synastry sections (free section 1; plus = all) |
| `/api/void/posts` | GET (drift feed) / POST (compose → moderate → publish) |
| `/api/void/echo` | POST | One echo per viewer per post; never returns counts |
| `/api/shop/checkout` | POST | Mock in M0; Stripe session in M2 |
| `/api/saved` | GET/PUT/DELETE | Saved items |

---

## 8. Prototype (M0) implementation map — this repo

| Product surface | Prototype implementation |
|---|---|
| Shell | `page.tsx` state machine: `onboarding → app(tabs)`; desktop = screen index + phone frame, mobile = fullscreen app |
| Onboarding | 4 steps + reveal; Input/Command/Dialog shadcn; demo chart regardless of entered data (prototype note shown in mono) |
| Home | Day header, day sketch, transit window cards w/ mini orbit diagram, friend sky strip (ScrollArea), retrograde accordion |
| Friends | Rows like web reference (big-three mono glyphs), friend detail w/ overlay wheel toggle + similarity panel, relationship analysis Sheet with aspect receipts |
| Void | Starfield canvas archive, drift feed w/ decay states, composer Drawer, Echo long-press w/ haptic + toast, report AlertDialog |
| Shop | Filter chips, product grid, product Dialog (variant Select), cart Sheet with add/remove + toast |
| You | Chart/Saved/Settings Tabs; reading cards verbatim to reference where provided + invented siblings in-voice; wheel header; Saved list; Settings with Switches + AlertDialog recast confirm |
| Data | `src/lib/our-sky/data.ts` — one coherent demo chart (matches reference placements), friends, transits, products, void posts |
| Art | `public/art/*.png` — generated grainy B&W collage assets (meteorite, skull, dove, garlic, moon, hand, earth, starfield) |

**Prototype honesty rules:** mono "DEMO DATA" tags where data is canned; every interactive element actually works in-prototype (tabs, sheets, toasts, echo, cart); no dead buttons — if it's not buildable in M0 it's visibly disabled, never fake-broken.

---

## 9. Security & privacy

- Birth data = special-category-adjacent: encrypt at rest, never log, export + delete account flows in Settings (product §5.5), no third-party analytics on chart screens.
- Void: author identity never leaves the server; `authorId` not joinable from API responses; screenshots of others' posts discouraged by design (share renders username-free cards).
- Moderation logs human-reviewable, PII-stripped.

## 10. Testing

- **Unit:** astro engine golden-chart fixtures; similarity weights; decay math; banned-word lint.
- **Contract:** API schema tests (zod) for every route.
- **E2E:** cast → home → friend add → echo → cart happy paths (Playwright).
- **Voice QA:** 5% random sample of reading cache re-audited each release against voice rules.

## 11. Performance & ops budgets

- Chart cast p95 < 800ms (ephemeris is ms-fast; houses dominate); Home TTFB < 300ms cached; Void feed < 200ms.
- Reading cache hit ratio > 99.5% (LLM only on cache miss at ingest).
- One deployable; Postgres + object storage only; moderation queue in admin UI.

---

*This spec shapes the M0 mockups living in this repo: production-shaped components, demo data, real design tokens.*

> **Privacy note:** All names, handles, emails, and birth details used anywhere in this product are fictional demo data invented for the mockups. No real persons are referenced.
