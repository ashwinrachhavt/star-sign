# Star Sign — Design System v2

Status: detailed draft for review, not an accepted replacement for the existing Notion guide.
Owner: Ashwin Rachha.
Scope: shared visual language and interaction contracts for Star Sign web and iOS, derived from the uploaded our-sky prototype.

## 1. Purpose and source precedence

This document turns a visually coherent prototype into a reusable, accessible, implementable system. It specifies foundations, components, content patterns, interaction states, responsive behavior, and review gates. It does not authorize a new product scope or assert that the uploaded code is deployed or committed.

Evidence labels:
- Observed: directly present in an uploaded file.
- Existing guidance: present in the fetched Notion Design System v1 or Linear ASH-225.
- Proposed: a production rule introduced or resolved by this draft; requires owner approval.
- Prototype-only: an interaction or visual experiment not authorized for release by the current Product spec.

Precedence by subject: the approved Product spec governs scope, consent, and uncertainty; this document proposes presentation rules; source files demonstrate prototype behavior, not approved domain truth. Aesthetic decisions here that conflict with v1 remain proposals until approved.

The GitHub default-branch root inspected for this task contains README.md and agents/. The uploaded prototype is a separate evidence source; no committed implementation parity was verified. ASH-225 remains a backlog epic, not proof of completed components.

## 2. Design thesis

An editorial atlas of the self: intimate, astronomical, spare, and quietly unusual. The interface should feel like an archival publication opened at night—not a generic dashboard, neon zodiac app, or imitation of a competitor.

Principles:
1. Reading is the primary interaction. Put hierarchy, line length, and comprehension before decoration.
2. Three type voices: serif for display, sans for explanation, mono for structure.
3. Organize with spacing and hairlines, not elevation or excessive fills.
4. Keep art separate from evidence. An atmospheric drawing must never imply computed geometry.
5. Let the user understand why. Provenance and uncertainty are normal parts of the design.
6. Protect intimacy. A chart is personal; social meaning is permissioned, not public by default.
7. Delight never blocks the task. Motion is optional and must not delay reading or controls.
8. Preserve clarity under stress: errors, deletion, consent, and privacy use literal language.

Avoid purple gradients, glitter, neon accent palettes, glassmorphism, pill-shaped generic cards, shadow stacks, decorative emoji, autoplay spectacles, and shame-based copy.

## 3. Reconciliation with the existing system

| Topic | Existing guidance | Uploaded prototype | Proposed resolution |
| --- | --- | --- | --- |
| Background/ink | #0d0d0d / #e8e6e1 | #050505 / #f2f2f0 | Adopt uploaded palette for the app after approval; migrate, do not mix both palettes. |
| Serif | Playfair Display or Fraunces suggestions | Source Serif 4 loaded in layout.tsx | Use Source Serif 4 as the concrete draft baseline. |
| Theme | Dark-first with light/marketing inversion | Explicit always-dark app | Ship dark app first; light/marketing themes require separate token maps and testing. |
| Accent | No UI accent; restrained content heart | Red destructive token and scattered red hints | Reserve red for destructive/error meaning; do not reuse it for attraction, importance, and errors simultaneously. |
| Motion | 120/200/320ms, restrained fades/translates | Infinite art drift, canvas twinkle, reveal rotation | Keep short functional transitions; disable continuous ambient motion by default. |
| Navigation | Reference labels include Home/Friends/Void/Shop/You | Same five-tab shell | Component supports configured destinations; Product decides routes. Void/Shop remain prototype-only. |
| Accuracy | Disclosed calculated evidence | Static chart, Placidus-flavoured cusps, fixed-angle OrbitMini | Renderer accepts validated data; no hard-coded chart facts or misleading diagrams. |

Avatar circles, astronomical circles, and system-native controls are exceptions to the square-corner rule. PhoneFrame's rounded hardware and shadows belong to the review harness, not product chrome.

## 4. Color foundations

Observed in globals.css:

| Semantic role | Token | Value | Use |
| --- | --- | --- | --- |
| App canvas | --background | #050505 | Page, full-screen reading surface |
| Primary ink | --foreground | #f2f2f0 | Titles, primary controls, active navigation |
| Card | --card | #050505 | Same as canvas; transparent hairline card is preferred |
| Overlay surface | --popover | #0a0a0a | Dialogs, sheets, popovers |
| Subtle surface | --secondary / --muted | #141414 | Selected/inset areas, not every card |
| Hover surface | --accent | #1a1a1a | Neutral interaction fill; not a chromatic accent |
| Secondary ink | --muted-foreground | #8a8a8a | Supporting text and labels |
| Decorative divider | --border | #2a2a2a | Nonessential layout separators |
| Destructive | --destructive | #e23636 | Destructive semantics; pair with text/icon |
| Focus | --ring | #f2f2f0 | Visible focus outline |

Proposed additions: --text-body: #d6d6d3; --text-support: #b8b8b5; --border-control: #8a8a8a; --focus-color: #f2f2f0. These consolidate values already scattered through components and separate decorative borders from boundaries needed to identify controls.

Life-area states remain words: HOT, WARM, QUIET. No red/green mood scale, predictive probabilities, or color-only meaning. Positive outcomes are not assigned green merely to imitate dashboard conventions.

### 4.1 Computed contrast audit

Ratios below were calculated with WCAG relative luminance against opaque #050505. They do not validate opacity, images, blends, overlays, or other backgrounds.

| Foreground | Ratio | Draft rule |
| --- | --- | --- |
| #f2f2f0 | 18.18:1 | Primary readable ink |
| #d6d6d3 | 13.99:1 | Reading prose |
| #b8b8b5 | 10.25:1 | Supporting prose |
| #8a8a8a | 5.90:1 | Small readable secondary text |
| #6a6a6a | 3.77:1 | Not normal-size essential text |
| #5f5f5f | 3.19:1 | Not normal-size essential text |
| #5a5a5a | 2.96:1 | Decoration only, not required information |
| #4a4a4a | 2.30:1 | Decoration or truly inactive controls only |
| #2a2a2a | 1.42:1 | Decorative separator, not sole necessary control boundary |
| #e23636 | 4.67:1 | Narrow text margin on this background; retest all other uses |

WCAG 2.2 AA generally requires 4.5:1 for normal text, 3:1 for qualifying large text, and 3:1 for applicable non-text UI information. Do not classify 11px uppercase mono as large text. Placeholder text is not a replacement for a label and must be readable when used. Disabled controls have exceptions but still need understandable context.

## 5. Typography

Observed font loading: Source Serif 4 normal/italic, Inter, IBM Plex Mono 400/500 through next/font/google. Current subset configuration is Latin; global language support and glyph coverage are not demonstrated.

Proposed scale in CSS pixels; use rem on web and scalable platform equivalents on iOS:

| Role | Face | Size / line height | Weight / tracking |
| --- | --- | --- | --- |
| Brand / major reveal | Source Serif 4 | 40 / 44 | 400, -0.01em |
| Screen title | Source Serif 4 | 32 / 38 | 400, -0.01em |
| Reading card title | Source Serif 4 | 28 / 34 | 400, -0.01em |
| Compact transit title | Source Serif 4 | 24 / 30 | 400, -0.01em |
| Reading body | Inter | 16 / 26 | 400, normal tracking |
| Supporting body | Inter | 14 / 22 | 400 |
| Structural label / navigation | IBM Plex Mono | 12 / 18 | 400 or 500, 0.08–0.12em |
| Compact metadata | IBM Plex Mono | 11 / 16 | 400, 0.06em; nonessential density only |
| House numeral | Source Serif 4 | 32 / 36 | 400 |

The prototype's 10–11px labels with 0.14–0.18em tracking are observed, not mandatory. Increase navigation and consequential metadata readability. Use sentence case for prose/titles and uppercase for short structural labels. Preserve user names and handles without forced uppercase.

Keep reading measure approximately 45–65 characters, target 60ch. Let long titles wrap; do not truncate explanations, privacy notices, or consent terms. Use tabular numerals for dates and degrees when supported. Choose glyph fallbacks for astrology symbols and test each required character on web/iOS; do not assume a mono family covers them all.

## 6. Spacing, shape, and layout

Proposed spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. The 20px step preserves the uploaded screens' common mobile gutters.

- Mobile horizontal gutter: 20px; compact viewport exception: 16px.
- Standard card padding: 24px; compact card: 20px; minimum narrow layout: 16px.
- Title-to-body: 12px. Body paragraph gap: 16px. Body-to-footer: 20px.
- Card gap: 24px. Section gap: 32–48px. Art interlude: reserve its own flow space.
- Border: 1 CSS px. Active tab indicator: 2px. Focus outline: 2px with 2px offset.
- Card/button/input radius: 0. Avatar: circular. No product card elevation.
- Reading column maximum: 640px, with 60ch prose measure.

Do not derive negative radii: globals.css currently calculates small radii by subtracting from zero. Set every square variant explicitly to zero. Use named circle tokens only where meaningful.

### 6.1 Responsive shell

The uploaded page.tsx switches at Tailwind md between full-screen mobile and a desktop showcase. PhoneFrame is a 390×780 review device with fake status chrome, not the desktop product design.

Proposed product behavior: single-column content at small widths; centered reading column with optional contextual side panel on wide screens. Use content-driven breakpoints, test 320/390/768/1280 CSS-pixel widths, 200% text zoom and reflow at narrow equivalent widths. The showcase is a separate review route.

Use a real viewport, safe-area insets, and keyboard-aware bottom padding. A fixed bottom bar must not cover the last action, focused control, or validation message. Do not hard-code a 780px viewport or reproduce fake OS status icons in production. Avoid nested scroll regions except where necessary, such as a place picker or modal.

Proposed layer tokens: content 0, sticky navigation 10, backdrop 30, dialog/sheet 40, toast 50. Respect platform modal layers; do not solve stacking issues with arbitrary large z-index values.

## 7. Component contracts

The following 15 contracts form the core inventory. Some are present as standalone source components; others are repeated patterns or requirements. ReadingCard.tsx is imported but not included in the upload, so its implementation is not verified. A file import is not evidence that an accessible component exists.

| Component | Anatomy and variants | Required behavior |
| --- | --- | --- |
| ScreenHeader | Optional back action, serif title, mono context; optional subnavigation | One logical page heading; back action has an accessible name; wraps without overlap. |
| PrimaryNavigation | Evenly allocated destinations, label, active indicator | Configurable routes; no implication that Void/Shop are approved. Active page announced; all controls touch/keyboard reachable. |
| SubTabs | Chart/Saved/Settings-style labels and underline | Use proper tab semantics for panels or links for routes, not a hybrid; correct keyboard behavior. |
| ProfileHeader | Avatar, display name, handle, supported key placements | Names/glyphs wrap; unknown rising sign says unavailable; hide unshared partner fields. |
| PlacementCard / ReadingCard | Optional eyebrow, serif title, prose, evidence link, optional consented similarity footer, save action | Collapsible/expanded variants; no nested interactive targets; keep privacy and uncertainty explicit. |
| TodayGlance | Date/sky context, headline, paragraph, Dos/Don'ts, life areas, evidence entry | Complete core reading without animation or deep navigation; truthful generated-at time. |
| DosDonts | Two labeled groups with three items each | Stack on small screens, use semantic lists; low-stakes wording; not a red/green success test. |
| LifeAreaRow | Domain left, HOT/WARM/QUIET right | Explain interpretive emphasis; text state announced, not color only. |
| ChartTable | Body/sign/degree/house fields, glyph, supported retrograde marker | Semantic row/column headers; preserve logical reading order when grouping; no false house numbers. |
| ChartWheel | Zodiac/house geometry, placements, aspect layers, legend | Validated data input; textual table alternative; no cosmetic transform of numerical evidence. |
| TransitEventCard | Date range, serif title, short explanation, optional diagram/evidence | Global vs personal event distinction; readable timezone; empty/uncertain timing variants. |
| ConnectionRow | Avatar/name, connection state, permitted summary, action | Requested/accepted/revoked states; no unsupported similarity percentages or private updates. |
| ProvenanceBlock | Disclosure, factual basis, configuration/version, uncertainty explanation | Concise entry, complete detail on demand; not low-contrast fine print; accessible expanded state. |
| Action / Input primitives | Text action, outline/solid submit, destructive; text/date/time/place inputs, precision selector | Labels, validation, busy states, focus treatment, real disabled semantics, no optimistic false success. |
| ArtFigure | Decorative or meaningful image; static and optional motion variants | Reserve dimensions; never block interaction; empty alt only when decorative; license/source metadata. |

Additional shared primitives: badge, accordion, dialog, alert dialog, sheet, drawer, toast, toggle/switch, avatar, separator, loading/empty/error panel. Wrap the existing UI library once to enforce tokens; do not create a separate styling dialect inside each screen.

### 7.1 Standard reading-card anatomy

Eyebrow (optional) → title → interpretation paragraphs → uncertainty/context where needed → evidence/action footer. A card is an article, not automatically a large button. Use a named link to open detail; make icon controls independent, labeled controls. Save uses pressed/saved state and an explicit failure path.

Suggested interface, not an implemented component:

```ts
type EvidenceState = 'verified' | 'uncertain' | 'unavailable' | 'demo';
interface ReadingCardProps {
  id: string;
  title: string;
  paragraphs: string[];
  evidenceState: EvidenceState;
  uncertaintyText?: string;
  saved?: boolean;
  onSave?: () => void;
  evidenceHref?: string;
}
```

### 7.2 Buttons, fields, and overlays

Primary submit: warm-white fill and dark ink, 48px preferred height, square corners. Secondary: transparent with sufficient visible border. Tertiary: underlined text action. Destructive: literal label plus destructive styling and confirmation when appropriate. Do not use expressive “cosmic” labels for deleting data or revoking access.

Input labels persist above the field. Help, required/optional status, precision, and errors have their own slots. Use actual label association and described-by relationships. A disabled Continue button does not explain an invalid date; add a clear validation message. Preserve input on errors and on navigation back.

Dialog/sheet: title, plain description, content, explicit actions; contain focus, support appropriate dismissal, restore focus to trigger. Mobile keyboard must not hide form actions. Critical confirmation stays in a modal, not a toast. Toasts confirm noncritical outcomes and announce appropriately; success appears only after durable success, not merely local state change.

## 8. Chart and diagram integrity

Observed: ChartWheel imports fixed CHART/ASC/ASPECTS and hard-coded cusps; it nudges glyph longitudes to reduce collisions. Aspect chord endpoints are derived from nudged glyph positions. This is acceptable as labeled artwork, not a precise evidence renderer.

Proposed production contract:
- Supply actual longitudes, cusps, aspect data, computation configuration, and uncertainty through typed props.
- Maintain separate true coordinates and label-layout coordinates. Nudge only labels; use leader lines and anchor aspects/ticks to true coordinates.
- Treat 0°/360° wrap-around clustering explicitly. Test crowded clusters, coincident placements, narrow layouts, and missing houses.
- Display the adopted house system from the data. The uploaded Placidus text cannot silently supersede current planning conventions.
- Do not continuously rotate the chart; a rotated astronomical diagram can change apparent orientation and comprehension.
- Distinguish natal and transiting layers using line treatment, labels, and a legend, not red alone.
- If there is no reliable Ascendant, do not pin to an invented one; render a labeled no-houses variant or use the table.

OrbitMini explicitly uses fixed art-directed angles, not an ephemeris. Label it “Illustrative diagram,” or render accurate geometry from the underlying event. It must not be an unlabeled visual proof of a specific aspect.

## 9. Imagery, icons, and grain

Observed ArtFigure uses black-background PNGs, opacity 0.92 by default, optional drift, and mix-blend-lighten. Its comment claims no blend trick is necessary, but the implementation does apply one. Verify art on the actual #050505 surface rather than copying this assumption.

Production direction: sparse monochrome photographic fragments—moons, terrestrial forms, archival scientific artifacts. Original, commissioned, appropriately licensed, or demonstrably public-domain sources only. A NASA association is not a blanket license for every image; retain individual credit and usage terms. Generated images also need a recorded origin and appropriate rights review.

For each asset record ID, source, rights/credit, dimensions, crop, background treatment, and decorative/semantic purpose. The /art image binaries are not in this upload; their visual quality and rights were not verified.

Art remains outside reading copy blocks and below interaction layers. No grain layer over letters, chart evidence, or controls. The prototype applies .grain on the phone/mobile shell; move it into contained art wrappers. Decorative canvas is hidden from assistive technology and cannot carry required information.

Lucide utility icons use currentColor and a consistent proposed 18px size/1.5px stroke; preferred controls still have at least 44px hit regions. Astrology glyphs are text symbols with accessible labels, not substitutes for names. Add a legend instead of requiring glyph literacy.

## 10. Motion

Observed: 9-second art drift, 4-second pulsing dots, 120-second spin utility, requestAnimationFrame starfield, translated onboarding panels, and staged reveals. The files do not demonstrate a complete reduced-motion path.

Proposed tokens: fast 120ms, standard 200ms, slow 320ms; easing cubic-bezier(0.2, 0, 0, 1). Functional motion is limited to short opacity/4–8px translate transitions. No bounce. Do not delay access to the chart behind staged reveal timers.

Ambient motion is off by default for production core reading screens. If enabled elsewhere, provide pause/stop controls where required, honor reduced motion, stop work when hidden/offscreen, and use elapsed time rather than a fixed “16ms per frame” step. Reduced motion disables CSS animations, Framer Motion transitions, and canvas RAF animation—not only one layer.

Under reduced motion, cards remain visible, charts appear immediately, and toasts/dialogs preserve their complete content and focus behavior. Automated screenshot fixtures use a deterministic, animation-disabled state.

## 11. Interaction and system states

Every core pattern defines default, hover (when available), focus-visible, pressed, selected, disabled, busy, error, empty, uncertain, unavailable, and permission-denied states as applicable. Hover is an enhancement, never the only way to reveal essential actions.

Required screen-level fixtures:
- First-time onboarding; invalid date; ambiguous place; exact/approximate/unknown time; calculation unavailable.
- Today loading; saved reading; generation failure; quiet day; missing time-dependent evidence.
- Chart with no houses; crowded glyphs; long translated labels; missing avatar/art.
- No connections; pending request; accepted permission scope; revoked access; report unavailable.
- Save failure; export processing; deletion confirmation; session expired.

Loading uses a restrained static placeholder and clear status, not an endless fake cosmic calculation. Empty states name what is missing and an appropriate next action. Retry keeps input intact. “No event selected” is not “nothing will happen today.”

## 12. Content, privacy, and product boundaries

The uploaded editorial tone is specific and sometimes abrasive. Preserve distinctiveness without insults, fatalism, psychological diagnoses, or fear. Approved hierarchy: factual evidence → interpretation → optional reflective action.

Replace misleading prototype copy:
- Not: “Your planets in signs stay exact.” Use: “Some placements may remain uncertain without a birth time.”
- Not: a fixed big-three reveal for every input. Show actual supported results or an explicit demo label.
- Not: “Nobody will know. Not even us.” State the real visibility, retention, and operator-access policy.
- Not: “Your friend needs flowers” as knowledge of a private emotional state. Offer permissioned interpretive context without claiming actual feelings.

Unknown-time UI must not show noon-derived rising/houses as real data. Error and consent copy must remain literal. Consequential uncertainty and privacy disclosures cannot be hidden behind tiny dim labels.

Prototype-only archive: Void feed, echoes/fading content, Shop/cart/checkout, aggressive social hooks, red attraction highlights, similarity percentages, and always-on atmospheric animation. These are not released Star Sign requirements. Extract reusable generic components, but require a product decision before adopting the surfaces. Do not turn the uploaded spec into an implicit override of the approved no-public-feed, consent-first Product spec.

## 13. Accessibility baseline

Proposed web target: WCAG 2.2 AA; test native equivalents and platform assistive technologies on iOS. This is a target, not a conformance claim.

- Normal text 4.5:1, qualifying large text 3:1, applicable non-text UI 3:1.
- Preferred product touch target 44×44 CSS px on web / 44pt on iOS. WCAG 2.2 AA's target-size minimum is 24×24 CSS px with exceptions, not a blanket 44px mandate.
- Visible 2px focus outline with 2px offset is this system's stronger design rule. Ensure focus is not hidden by sticky chrome, overlays, or keyboard.
- Correct landmarks, headings, labels, tab semantics, dialog behavior, and keyboard order.
- Accessible chart alternative with all meaningful values and uncertainty.
- 200% text resizing and narrow-layout reflow without loss of tasks/content; native text scaling.
- No color-only or glyph-only meaning. No hover-only save/report/revoke controls.
- Respect reduced motion and provide appropriate controls for prolonged autoplay movement.
- Dynamic status messages announced without stealing focus; error summaries link to fields.

Use https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/WCAG22/quickref/ as normative/implementation references. Manual VoiceOver/keyboard review remains necessary alongside automated checks.

## 14. Implementation architecture and governance

Proposed structure (not claimed to exist):

```text
packages/design-tokens/   portable semantic source and generated platform exports
apps/web/components/ui/   styled accessible primitives
apps/web/components/astrology/  domain compositions
apps/mobile/components/  native equivalents
apps/web/design-review/  fixtures/showcase, separate from production routes
```

Keep primitive palette, semantic aliases, typography, spacing, shape, motion, and layering in the token source. Export CSS custom properties and typed native objects; share semantics and contracts, not DOM markup. Verify font metrics rather than assuming browser pixels equal native typography.

Token patch proposal:

```css
:root {
  --text-body: #d6d6d3;
  --text-support: #b8b8b5;
  --border-control: #8a8a8a;
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;
  --radius-xl: 0;
  --space-card: 1.5rem;
  --motion-fast: 120ms;
  --motion-standard: 200ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

No screen-local raw color/typographic/motion values after migration; explicit exceptions require rationale. Semantic colors and text-role tokens are preferred to proliferating one token per arbitrary value. Preserve responsive expressions and calculated geometry where needed; “tokens only” does not forbid computation.

Lifecycle: proposed → reviewed → accepted → implemented → verified → deprecated. A proposal includes problem, anatomy, states, platform mapping, accessibility, fixture, and migration effect. Deprecations identify replacement and removal gate. Record decision owner, version, and evidence; do not label a screenshot-derived approximation “verified” without qualification.

## 15. Delivery plan and definition of done

Map to existing ASH-225 child tracks; do not modify tickets without approval:
1. Tokens (ASH-241): approve palette and semantic mappings; remove duplicate hexes and negative radii; contrast audit all states.
2. Typography (ASH-242): adopt approved faces/roles; replace tiny required text; verify glyph and language coverage.
3. Components (ASH-243): implement 15 contracts and shared states; obtain missing ReadingCard source or replace deliberately; interaction/accessibility fixtures.
4. Screens (ASH-244): apply to Today, onboarding, chart/profile, connection flows, and authentication as scoped; remove demo facts and false privacy copy.
5. Mobile parity (ASH-245): native tokens/fonts, safe areas, Dynamic Type/VoiceOver, shared domain states.

Release gate:
- Approved scope and documented conflict resolutions; no silent Void/Shop adoption.
- Token-only foundations with documented exceptions; no negative radii.
- All necessary text and control boundaries meet contrast in actual rendered states.
- Functional keyboard, focus, reduced-motion, screen-reader, touch, and text-scaling tests.
- Chart/table parity and true-coordinate evidence; no hard-coded demo placements in production.
- Consent and revocation enforced beyond visual hiding.
- Assets have rights/provenance records; meaningful content survives image/font/provider failure.
- Visual regression fixtures at agreed widths and zoom/text scales, with deterministic data and motion disabled.
- Web/iOS contract parity is evidenced, not presumed from shared TypeScript.

## 16. Decisions requiring owner approval

1. Adopt #050505/#f2f2f0 and Source Serif 4 instead of the earlier v1 suggestions?
2. Dark-only app for the initial release; separate marketing/light-theme specification?
3. Use red exclusively for destructive/error semantics, not attraction or life-area intensity?
4. Replace continuous ambient animation with static-first reading surfaces?
5. Accept the proposed readable type scale, control boundaries, responsive shell, and chart layout rules?
6. Keep Void and Shop explicitly archived until a separate product-scope decision?

## 17. Source register and review limits

Uploaded foundations: globals.css, layout.tsx, ArtFigure.tsx, BottomNav.tsx, ChartWheel.tsx, OrbitMini.tsx, Starfield.tsx, PhoneFrame.tsx, page.tsx.
Uploaded screen/state context: HomeScreen.tsx, Onboarding.tsx, FriendsScreen.tsx, YouScreen.tsx, VoidScreen.tsx, ShopScreen.tsx, store.ts.
Uploaded draft intent: product-spec.md v0.3 and tech-spec.md v0.3. Their market/engine/privacy claims were not adopted as verified facts.
Existing workspace: Notion Design System v1, current Product decisions from this conversation, Linear ASH-225. GitHub inspected: ashwinrachhavt/star-sign default-branch root only for this task.

Limits: source inspection and mathematical opaque-color contrast audit only. No running build, screenshot rendering, full accessibility audit, native implementation test, external asset inspection, font-license audit, or verification of missing primitive/component implementations. Earlier reference screenshots supplied in the conversation provide context, but the current draft's measurements come from code, not asserted image sampling.
