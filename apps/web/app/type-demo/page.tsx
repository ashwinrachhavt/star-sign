import "./demo.css";

/* ASH-242 AC2 — demo page exercising the three type voices (design-system §3):
   serif display / sans prose / mono structural. Visually checked against
   design/reference/1.png and 8.png. Type role discipline (§3):
   a card title is never mono; a label is never serif. */

const PLACEMENTS = [
  { sign: "Cancer", placements: "↑ ASCENDANT   ♀ VENUS   ♂ MARS", house: 1 },
  { sign: "Leo", placements: "☉ SUN   ☿ MERCURY", house: 2 },
  { sign: "Scorpio", placements: ") MOON   ♇ PLUTO", house: 4 },
  { sign: "Sagittarius", placements: "♆ NEPTUNE", house: 6 },
];

export default function TypeDemoPage() {
  return (
    <main className="demo">
      <header className="demo-header">
        <h1 className="type-display t-36">Type system</h1>
        <p className="type-micro-label t-11">Three voices — strict roles</p>
      </header>

      <section className="demo-card">
        <h2 className="type-display t-28">Pluto in Sagittarius</h2>
        <p className="type-prose t-17">
          Pluto stays in each sign for up to thirty years, meaning it rules a
          generation more than a person. It rules power, intensity, obsession,
          and control. Your Pluto is in Sagittarius, meaning your generation's
          psyche is comparatively positive, free-spirited, curious, optimistic,
          forward-looking, independent, and confident.
        </p>
        <p className="type-prose t-17">
          It's in your sixth house, meaning you personally are transforming
          outdated approaches to day-to-day experiences of work, routines, and
          bodily health.
        </p>
        <footer className="type-mono t-13 demo-footer">
          ♇ PLUTO — <span className="demo-link">SIMILAR CHARTS →</span>
        </footer>
      </section>

      <section className="demo-card">
        <p className="type-micro-label t-11">Natal chart</p>
        <div className="demo-chart">
          <span className="demo-axis type-micro-label t-11 demo-axis-left">
            Signs
          </span>
          <div className="demo-rows">
            {PLACEMENTS.map((row) => (
              <div className="demo-row" key={row.sign}>
                <span className="type-sans t-15 demo-sign">{row.sign}</span>
                <span className="type-mono t-13">{row.placements}</span>
                <span className="type-display t-28 demo-house">{row.house}</span>
              </div>
            ))}
          </div>
          <span className="demo-axis type-micro-label t-11 demo-axis-right">
            Houses
          </span>
        </div>
      </section>

      <section className="demo-card">
        <p className="type-micro-label t-11">Scale — 11 / 13 / 15 / 17 / 22 / 28 / 36</p>
        <div className="demo-scale">
          <span className="type-mono t-11">11 mono caps label</span>
          <span className="type-mono t-13">13 mono data line</span>
          <span className="type-sans t-15">15 sans secondary prose</span>
          <span className="type-sans t-17">17 sans reading prose</span>
          <span className="type-display t-22">22 serif subtitle</span>
          <span className="type-display t-28">28 serif card title</span>
          <span className="type-display t-36">36 serif display</span>
        </div>
      </section>
    </main>
  );
}
