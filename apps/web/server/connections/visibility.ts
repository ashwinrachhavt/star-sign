/**
 * Partner chart visibility projection (ASH-257 / 5.2).
 *
 * Implements the owner-approved visibility matrix:
 *   requested  → nothing (request notification only)
 *   accepted   → natal chart placements (sign + house), NOT birth data,
 *                NOT readings
 *   revoked /
 *   disconnected → nothing, immediately
 *
 * The projection is allowlist-based: it never selects raw birth fields —
 * only the computed placement signs/houses the accepted scope permits.
 * Cross-state reads fail closed (criterion 1/4; tested in the harness).
 */
import type { NatalChart } from "@star-sign/core";

export type ConnectionState =
  | "requested"
  | "accepted"
  | "revoked"
  | "disconnected";

export interface PartnerChartProjection {
  connectionId: string;
  state: ConnectionState;
  /** Present only in accepted state. */
  placements?: Array<{
    planet: string;
    sign: string;
    house?: number;
  }>;
  /** Copy.md rule 5 consent line. */
  consentNote: string;
}

export function consentCopy(partnerName: string): string {
  return `Only ${partnerName} can see this, and they can turn it off at any time.`;
}

/**
 * Projects the partner-visible slice of a chart per connection state.
 * `chart` is the partner's natal chart; it is read only when the state is
 * `accepted` and the recorded share scope is `chart_placements` — any
 * other state returns the empty projection (matrix rows 1 and 3).
 */
export function projectPartnerChart(
  state: ConnectionState,
  shareScope: "none" | "chart_placements",
  chart: NatalChart | null,
  connectionId: string,
  partnerName: string,
): PartnerChartProjection {
  if (state === "accepted" && shareScope === "chart_placements" && chart) {
    return {
      connectionId,
      state,
      placements: chart.placements.map((p) => ({
        planet: p.planet,
        sign: p.sign,
        ...(p.house !== undefined ? { house: p.house } : {}),
      })),
      consentNote: consentCopy(partnerName),
    };
  }
  return {
    connectionId,
    state,
    consentNote: consentCopy(partnerName),
  };
}
