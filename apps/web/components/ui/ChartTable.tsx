import { fontMono, fontSerif } from "@/app/fonts";

export type ChartTableRow = {
  sign: string;
  placements: string;
  house: string | number;
};

export function ChartTable({
  rows,
  axisLabels = { left: "Signs", right: "Houses" },
}: {
  rows: ChartTableRow[];
  axisLabels?: { left: string; right: string };
}) {
  return (
    <div className="ui-chart-table">
      <span
        className={`ui-chart-table-axis ui-chart-table-axis-flipped type-micro-label t-11 ${fontMono.className}`}
        aria-hidden="true"
      >
        {axisLabels.left}
      </span>
      <div className="ui-chart-table-body" role="table" aria-label={axisLabels.left}>
        {rows.map((row) => (
          <div
            className="ui-chart-table-row"
            role="row"
            key={`${row.sign}-${row.placements}`}
          >
            <span className="type-prose t-15" role="cell">
              {row.sign}
            </span>
            <span
              className={`type-mono t-13 ${fontMono.className}`}
              role="cell"
            >
              {row.placements}
            </span>
            <span className="type-display t-28 ui-chart-table-house" role="cell">
              {row.house}
            </span>
          </div>
        ))}
      </div>
      <span
        className={`ui-chart-table-axis type-micro-label t-11 ${fontMono.className}`}
        aria-hidden="true"
      >
        {axisLabels.right}
      </span>
    </div>
  );
}
