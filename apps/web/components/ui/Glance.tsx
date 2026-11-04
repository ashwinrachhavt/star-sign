import { ReactNode } from "react";
import { fontMono } from "@/app/fonts";
import { CelestialMark } from "./CelestialMark";

export function Glance({
  label = "Today at a glance",
  headline,
  /** Deterministic seed picking the day's celestial ornament. */
  markSeed,
  children,
}: {
  label?: string;
  headline: string;
  markSeed?: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-card ui-glance">
      <p className={`ui-glance-label type-micro-label t-11 ${fontMono.className}`}>{label}</p>
      {markSeed && (
        <span className="ui-glance-mark">
          <CelestialMark seed={markSeed} size={72} />
        </span>
      )}
      <h2 className="type-display t-28" style={markSeed ? { paddingRight: 88 } : undefined}>
        {headline}
      </h2>
      <p className="type-prose t-17">{children}</p>
    </section>
  );
}
