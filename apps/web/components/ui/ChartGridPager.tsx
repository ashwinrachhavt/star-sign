"use client";

import { useState } from "react";
import { ChartGrid, type ChartGridRow } from "./ChartGrid";

/**
 * Pagination for the chart grid (ASH-267 ref 1.png): one page visible at
 * a time, dots below switch pages. Client component — the grid data is
 * fully server-rendered and passed in.
 */
export function ChartGridPager({
  pages,
  axisLabels,
}: {
  pages: ChartGridRow[][];
  axisLabels?: { left: string; right: string };
}) {
  const [page, setPage] = useState(0);
  const count = pages.length;
  const current = Math.min(page, count - 1);

  return (
    <div>
      <ChartGrid
        rows={pages[current]}
        axisLabels={axisLabels}
        pages={count}
        activePage={current}
      />
      {count > 1 && (
        <div className="ui-chart-grid-dots" role="tablist" aria-label="Chart pages">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Page ${i + 1}`}
              className="ui-chart-grid-dot-button ui-focusable"
              onClick={() => setPage(i)}
            >
              <span className="ui-chart-grid-dot" data-active={i === current} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
