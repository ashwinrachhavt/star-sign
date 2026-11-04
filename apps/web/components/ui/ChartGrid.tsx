import { fontMono, fontSerif } from "@/app/fonts";

export type ChartGridRow = {
  sign: string;
  /** Glyph + mono name pairs, e.g. "↑ ASCENDANT", "☉ SUN". */
  placements: Array<{ glyph: string; name: string }>;
  house: string | number;
};

export function ChartGrid({
  rows,
  axisLabels = { left: "Signs", right: "Houses" },
  pages = 1,
  activePage = 0,
}: {
  rows: ChartGridRow[];
  axisLabels?: { left: string; right: string };
  /** Total pages, for the group label; dots are the pager's job. */
  pages?: number;
  /** Zero-based page this grid represents. */
  activePage?: number;
}) {
  return (
    <div
      className="ui-chart-grid"
      data-page={activePage}
      role="group"
      aria-label={`Chart page ${activePage + 1} of ${pages}`}
    >
      <div className="ui-chart-grid-table">
        <span
          className={`ui-chart-grid-axis ui-chart-grid-axis-flipped type-micro-label t-11 ${fontMono.className}`}
          aria-hidden="true"
        >
          {axisLabels.left}
        </span>
        <div className="ui-chart-grid-body" role="table" aria-label={axisLabels.left}>
          {rows.map((row) => (
            <div
              className="ui-chart-grid-row"
              role="row"
              key={`${row.sign}-${row.placements.map((p) => p.name).join("/")}`}
            >
              <span className="type-prose t-15" role="cell">
                {row.sign}
              </span>
              <span className="ui-chart-grid-occupants" role="cell">
                {row.placements.map((p) => (
                  <span
                    className={`ui-chart-grid-occupant type-mono t-13 ${fontMono.className}`}
                    key={p.name}
                  >
                    <span aria-hidden="true">{p.glyph}</span> {p.name}
                  </span>
                ))}
              </span>
              <span className="type-display t-28 ui-chart-grid-house" role="cell">
                {row.house}
              </span>
            </div>
          ))}
        </div>
        <span
          className={`ui-chart-grid-axis type-micro-label t-11 ${fontMono.className}`}
          aria-hidden="true"
        >
          {axisLabels.right}
        </span>
      </div>
    </div>
  );
}
