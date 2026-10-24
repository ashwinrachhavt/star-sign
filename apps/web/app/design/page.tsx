import {
  Button,
  CardFooterLink,
  ChartTable,
  DosDonts,
  FriendRow,
  Glance,
  GrainImage,
  Input,
  LifeAreaRow,
  PlacementCard,
  ProfileHeader,
  ProvenanceBlock,
  ScreenHeader,
  TabBar,
  TransitEventCard,
} from "@/components/ui";
import "./design.css";

/* ASH-243 AC4 — review surface rendering all 15 v1 components (design-system §5). */

const AVATAR_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0%" stop-color="#c9c7c2"/><stop offset="100%" stop-color="#2e2d2b"/></radialGradient></defs><rect width="88" height="88" fill="url(#g)"/><circle cx="62" cy="30" r="9" fill="#8f8d88" opacity="0.7"/></svg>`
  );

const CHART_ROWS = [
  { sign: "Cancer", placements: "↑ ASCENDANT   ♀ VENUS   ♂ MARS", house: 1 },
  { sign: "Leo", placements: "☉ SUN   ☿ MERCURY", house: 2 },
  { sign: "Scorpio", placements: ") MOON   ♇ PLUTO", house: 4 },
  { sign: "Sagittarius", placements: "♆ NEPTUNE", house: 6 },
];

const TABS = [
  { id: "chart", label: "Chart", href: "#" },
  { id: "saved", label: "Saved", href: "#" },
  { id: "settings", label: "Settings", href: "#" },
];

const NAV = [
  { id: "home", label: "Home", href: "#" },
  { id: "friends", label: "Friends", href: "#" },
  { id: "void", label: "Void", href: "#" },
  { id: "shop", label: "Shop", href: "#" },
  { id: "you", label: "You", href: "#" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="design-section">
      <p className="design-section-label type-micro-label t-11">{title}</p>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="design-page">
      <main className="design-main">
        <Section title="ScreenHeader (1.png)">
          <ScreenHeader title="You" tabs={TABS} activeTab="chart" />
        </Section>

        <Section title="TabBar (all refs)">
          <TabBar items={NAV} activeItem="you" />
        </Section>

        <Section title="ProfileHeader (8.png)">
          <ProfileHeader
            name="You"
            handle="@ranchomacho"
            signLine="☉ Leo   ) Scorpio   ↑ Cancer"
            avatar={{ src: AVATAR_SRC, alt: "Profile avatar" }}
          />
        </Section>

        <Section title="PlacementCard + CardFooterLink (1.png)">
          <PlacementCard
            title="Pluto in Sagittarius"
            footer={<CardFooterLink glyph="☍" href="#" label="Similar to @mayasterling33" />}
          >
            <p className="type-prose t-17">
              Pluto stays in each sign for up to thirty years, meaning it rules a
              generation more than a person. It rules power, intensity, obsession,
              and control.
            </p>
            <p className="type-prose t-17">
              It&apos;s in your sixth house, meaning you personally are transforming
              outdated approaches to day-to-day experiences of work, routines, and
              bodily health.
            </p>
          </PlacementCard>
        </Section>

        <Section title="ChartTable (8.png)">
          <ChartTable rows={CHART_ROWS} />
        </Section>

        <Section title="Glance (product contract)">
          <Glance headline="A slow morning earns its keep">
            The Moon trines your natal Sun before noon — the day opens with quiet
            momentum. Spend it on the thing you keep postponing.
          </Glance>
        </Section>

        <Section title="DosDonts (13.png)">
          <DosDonts
            dos={["Lead with the ask, not the apology", "Take the meeting you dread"]}
            donts={["Reopen closed loops", "Answer messages before coffee"]}
          />
        </Section>

        <Section title="TransitEventCard (12.png)">
          <TransitEventCard dateRange="October 23 — November 7" title="Pluto trine natal Moon">
            You have a desire to expand your subconscious. There will be a chance
            opportunity that affects the fields of your natural talents.
          </TransitEventCard>
        </Section>

        <Section title="FriendRow (11.png)">
          <div className="design-stack">
            <FriendRow name="Hanna" signLine="☉ Pisces   ↑ Leo   ) Sagittarius" href="#" />
            <FriendRow name="Laura" signLine="☉ Cancer   ↑ Virgo   ) Cancer" href="#" />
          </div>
        </Section>

        <Section title="LifeAreaRow (product contract)">
          <div>
            <LifeAreaRow area="Love" state="Steady" />
            <LifeAreaRow area="Work" state="Surge" />
            <LifeAreaRow area="Home" state="Quiet" />
            <LifeAreaRow area="Friends" state="Active" />
          </div>
        </Section>

        <Section title="ProvenanceBlock">
          <ProvenanceBlock>
            <span>Placements: Swiss Ephemeris, geocentric</span>
            <span>Transits: exact, computed 2026-10-24</span>
            <span>Logic version: readings@1</span>
          </ProvenanceBlock>
        </Section>

        <Section title="Button (13.png)">
          <div className="design-row">
            <Button variant="link" href="#">
              Download iOS
            </Button>
            <Button variant="solid" type="submit">
              Save
            </Button>
          </div>
        </Section>

        <Section title="Input">
          <div className="design-stack">
            <Input id="demo-birth-time" label="Birth time" chip="Exact" placeholder="14:32" />
            <Input
              id="demo-birth-place"
              label="Birth place"
              chip="Approx."
              placeholder="City"
            />
          </div>
        </Section>

        <Section title="GrainImage">
          <GrainImage src={AVATAR_SRC} alt="Grainy B&W texture" width={120} height={120} />
        </Section>
      </main>

      <footer className="design-tabbar">
        <TabBar items={NAV} activeItem="you" />
      </footer>
    </div>
  );
}
